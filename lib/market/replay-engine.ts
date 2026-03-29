import { EventEmitter } from "events"
import { getBarsByDateRange, getLastTradingDay } from "./alpaca-rest"
import type { MarketTick, ReplaySpeed, ReplayState, Ticker } from "@/types"

// Each loaded bar ready to emit
interface ReplayBar {
  tick: MarketTick
  barTime: number // original bar timestamp for display
}

declare global {
  // eslint-disable-next-line no-var
  var __replayEngine: ReplayEngine | undefined
}

export class ReplayEngine extends EventEmitter {
  private bars: ReplayBar[] = []
  private index = 0
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private speed: ReplaySpeed = 1
  private date: string | null = null
  private barCache: Map<string, ReplayBar[]> = new Map() // key: "ticker:date"

  // Load bars for all tickers for a given date (defaults to last trading day)
  async load(tickers: Ticker[], date?: string): Promise<void> {
    const targetDate = date ?? (await getLastTradingDay())
    this.date = targetDate

    // Build start/end for that trading day (09:30–16:00 ET)
    const start = `${targetDate}T09:30:00-04:00`
    const end = `${targetDate}T16:01:00-04:00`

    // Fetch all tickers (check cache first)
    const allBars: ReplayBar[] = []
    for (const ticker of tickers) {
      const cacheKey = `${ticker}:${targetDate}`
      let tickerBars: ReplayBar[]
      if (this.barCache.has(cacheKey)) {
        tickerBars = this.barCache.get(cacheKey)!
      } else {
        const priceBars = await getBarsByDateRange(ticker, start, end)
        tickerBars = priceBars.map((bar) => ({
          tick: {
            ticker,
            price: bar.close,
            volume: bar.volume,
            timestamp: bar.time,
          } as MarketTick,
          barTime: bar.time,
        }))
        this.barCache.set(cacheKey, tickerBars)
      }
      allBars.push(...tickerBars)
    }

    // Sort by timestamp (interleave all tickers chronologically)
    allBars.sort((a, b) => a.barTime - b.barTime)
    this.bars = allBars
    this.index = 0
  }

  play(speed: ReplaySpeed = 1): void {
    this.speed = speed
    this.clearIntervalHandle()
    this.scheduleNext()
  }

  pause(): void {
    this.clearIntervalHandle()
  }

  resume(): void {
    if (this.index < this.bars.length) {
      this.scheduleNext()
    }
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed
    if (this.intervalHandle !== null) {
      this.clearIntervalHandle()
      this.scheduleNext()
    }
  }

  reset(): void {
    this.clearIntervalHandle()
    this.index = 0
  }

  getProgress(): Pick<
    ReplayState,
    "barIndex" | "totalBars" | "replayTimestamp" | "isComplete" | "replayDate"
  > {
    return {
      barIndex: this.index,
      totalBars: this.bars.length,
      replayTimestamp: this.bars[this.index]?.barTime ?? null,
      isComplete: this.index >= this.bars.length,
      replayDate: this.date,
    }
  }

  private scheduleNext(): void {
    const intervalMs = Math.max(1000 / this.speed, 20)
    this.intervalHandle = setInterval(() => {
      if (this.index >= this.bars.length) {
        this.clearIntervalHandle()
        this.emit("complete")
        return
      }
      // Emit all bars with the same timestamp in one batch
      const currentTime = this.bars[this.index].barTime
      while (
        this.index < this.bars.length &&
        this.bars[this.index].barTime === currentTime
      ) {
        this.emit("tick", this.bars[this.index].tick)
        this.index++
      }
    }, intervalMs)
  }

  private clearIntervalHandle(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  static getInstance(): ReplayEngine {
    if (!globalThis.__replayEngine) {
      globalThis.__replayEngine = new ReplayEngine()
    }
    return globalThis.__replayEngine
  }
}
