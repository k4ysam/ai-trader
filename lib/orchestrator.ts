import { EventEmitter } from "events"
import {
  DEFAULT_BOTS,
  WATCHLIST,
  AI_BOT_CADENCE_MS,
  PRICE_HISTORY_BARS,
  STARTING_BALANCE,
} from "@/lib/constants"
import { createPortfolio, executeOrder, updatePrices, calculateOrderQty } from "@/lib/portfolio"
import { rsiStrategy } from "@/lib/strategies/rsi"
import { smaCrossoverStrategy } from "@/lib/strategies/sma-crossover"
import { momentumStrategy } from "@/lib/strategies/momentum"
import { meanReversionStrategy } from "@/lib/strategies/mean-reversion"
import { callAIBot, createAIBotConfig, createGeminiGenerateFn } from "@/lib/bots/ai-bot"
import { createThrottle } from "@/lib/bots/throttle"
import { StateBroadcaster } from "@/lib/state-broadcaster"
import { StreamManager } from "@/lib/market/stream-manager"
import { ReplayEngine } from "@/lib/market/replay-engine"
import type {
  BotConfig,
  BotState,
  BotType,
  MarketSnapshot,
  MarketTick,
  Order,
  PriceBar,
  ReplaySpeed,
  SimMode,
  SimState,
  SimStatus,
  Ticker,
} from "@/types"
import type { Strategy, StrategyInput } from "@/lib/strategies/types"

// ─── Singleton guard ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __orchestrator: Orchestrator | undefined
}

// ─── Strategy registry ────────────────────────────────────────────────────────

const STRATEGY_MAP: Record<Exclude<BotType, "ai" | "custom">, Strategy> = {
  rsi: rsiStrategy,
  "sma-crossover": smaCrossoverStrategy,
  momentum: momentumStrategy,
  "mean-reversion": meanReversionStrategy,
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class Orchestrator extends EventEmitter {
  private state: SimState
  private aiThrottle = createThrottle(AI_BOT_CADENCE_MS)
  private geminiGenerateFn = this.buildGeminiFn()
  private mode: SimMode = "live"

  constructor() {
    super()
    this.state = this.buildInitialState()
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.state.status === "running") return
    this.state = { ...this.state, status: "running", startedAt: Date.now() }

    const stream = StreamManager.getInstance()
    stream.on("tick", this.onTick)

    // Connect stream if not yet connected
    if (!stream.listenerCount("tick")) {
      stream.connect(this.state.watchlist)
    } else {
      stream.connect(this.state.watchlist)
    }

    this.broadcast()
  }

  pause(): void {
    if (this.state.status !== "running") return
    this.state = { ...this.state, status: "paused" }
    if (this.mode === "replay") {
      ReplayEngine.getInstance().pause()
    } else {
      StreamManager.getInstance().off("tick", this.onTick)
    }
    this.broadcast()
  }

  resume(): void {
    if (this.state.status !== "paused") return
    this.state = { ...this.state, status: "running" }
    if (this.mode === "replay") {
      ReplayEngine.getInstance().resume()
    } else {
      StreamManager.getInstance().on("tick", this.onTick)
    }
    this.broadcast()
  }

  reset(): void {
    if (this.mode === "replay") {
      const engine = ReplayEngine.getInstance()
      engine.reset()
      engine.off("tick", this.onTick)
      engine.off("complete", this.onReplayComplete)
      this.mode = "live"
    } else {
      StreamManager.getInstance().off("tick", this.onTick)
    }
    this.state = this.buildInitialState()
    this.broadcast()
  }

  getState(): SimState {
    return this.state
  }

  addBot(config: BotConfig): BotState {
    const botState: BotState = {
      config,
      portfolio: createPortfolio(config.id),
      lastDecision: null,
      isActive: true,
    }
    this.state = {
      ...this.state,
      bots: [...this.state.bots, botState],
    }
    this.broadcast()
    return botState
  }

  removeBot(botId: string): void {
    this.state = {
      ...this.state,
      bots: this.state.bots.filter((b) => b.config.id !== botId),
    }
    this.broadcast()
  }

  updateBotParams(botId: string, params: Record<string, number>): void {
    this.state = {
      ...this.state,
      bots: this.state.bots.map((b) =>
        b.config.id === botId
          ? { ...b, config: { ...b.config, params: { ...b.config.params, ...params } } }
          : b
      ),
    }
    this.broadcast()
  }

  async startReplay(speed: ReplaySpeed = 1, date?: string): Promise<void> {
    if (this.state.status === "running") return
    this.mode = "replay"

    const engine = ReplayEngine.getInstance()
    await engine.load(this.state.watchlist, date)

    engine.on("tick", this.onTick)
    engine.once("complete", this.onReplayComplete)
    engine.play(speed)

    const progress = engine.getProgress()
    this.state = {
      ...this.state,
      status: "running",
      startedAt: Date.now(),
      replay: {
        mode: "replay",
        speed,
        replayDate: progress.replayDate,
        replayTimestamp: progress.replayTimestamp,
        barIndex: progress.barIndex,
        totalBars: progress.totalBars,
        isComplete: false,
      },
    }
    this.broadcast()
  }

  setReplaySpeed(speed: ReplaySpeed): void {
    if (this.mode === "replay") {
      ReplayEngine.getInstance().setSpeed(speed)
      this.state = {
        ...this.state,
        replay: { ...this.state.replay, speed },
      }
      this.broadcast()
    }
  }

  // ─── Tick handler ────────────────────────────────────────────────────────────

  private onTick = (tick: MarketTick): void => {
    if (this.state.status !== "running") return

    const { ticker, price } = tick

    // 1. Update price history ring buffer
    const existingBars = this.state.priceHistory[ticker] ?? []
    const newBar: PriceBar = {
      time: tick.timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: tick.volume,
    }
    const updatedBars = [...existingBars, newBar].slice(-PRICE_HISTORY_BARS)

    // 2. Update snapshot
    const prevSnapshot = this.state.snapshots[ticker]
    const prevClose = prevSnapshot?.prevClose ?? price
    const open = prevSnapshot?.open ?? price
    const high = Math.max(prevSnapshot?.high ?? price, price)
    const low = Math.min(prevSnapshot?.low ?? price, price)
    const change = price - prevClose
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0

    const newSnapshot: MarketSnapshot = {
      ticker,
      price,
      open,
      high,
      low,
      prevClose,
      change,
      changePercent,
    }

    // 3. Process rule-based bots synchronously
    const newBots = this.state.bots.map((bot) => {
      if (!bot.isActive) return bot
      if (bot.config.type === "ai") return bot // handled async below

      const strategy = STRATEGY_MAP[bot.config.type as Exclude<BotType, "ai" | "custom">]
      if (!strategy) return bot

      const input: StrategyInput = {
        ticker,
        bars: updatedBars,
        currentPrice: price,
        portfolio: bot.portfolio,
        params: bot.config.params,
      }

      const signal = strategy(input)
      if (signal.action === "HOLD") {
        const updatedPortfolio = updatePrices(bot.portfolio, { [ticker]: price })
        return { ...bot, portfolio: updatedPortfolio }
      }

      const qty = calculateOrderQty(bot.portfolio, ticker, signal.action, price, signal.confidence * 0.2)
      if (qty === 0) {
        const updatedPortfolio = updatePrices(bot.portfolio, { [ticker]: price })
        return { ...bot, portfolio: updatedPortfolio }
      }

      const order: Order = {
        botId: bot.config.id,
        ticker,
        action: signal.action,
        qty,
        price,
        timestamp: tick.timestamp,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
      }

      const newPortfolio = executeOrder(
        updatePrices(bot.portfolio, { [ticker]: price }),
        order
      )

      return { ...bot, portfolio: newPortfolio, lastDecision: order }
    })

    // 4. Collect recent orders for AI context
    const recentOrders = newBots
      .flatMap((b) => (b.lastDecision ? [b.lastDecision] : []))
      .slice(-5)

    // 5. Update state synchronously
    this.state = {
      ...this.state,
      bots: newBots,
      priceHistory: { ...this.state.priceHistory, [ticker]: updatedBars },
      snapshots: { ...this.state.snapshots, [ticker]: newSnapshot },
      tickCount: this.state.tickCount + 1,
    }
    if (this.mode === "replay") {
      const progress = ReplayEngine.getInstance().getProgress()
      this.state = {
        ...this.state,
        replay: {
          ...this.state.replay,
          replayTimestamp: progress.replayTimestamp,
          barIndex: progress.barIndex,
        },
      }
    }
    this.broadcast()

    // 6. Fire AI bot async (fire-and-forget, throttled per ticker)
    const aiBot = this.state.bots.find((b) => b.config.type === "ai")
    if (aiBot) {
      this.aiThrottle(ticker, async () => {
        const input: StrategyInput = {
          ticker,
          bars: updatedBars,
          currentPrice: price,
          portfolio: aiBot.portfolio,
          params: {},
        }
        return callAIBot(ticker, input, newSnapshot, recentOrders, this.geminiGenerateFn)
      }).then((signal) => {
        if (signal.action === "HOLD") {
          this.state = {
            ...this.state,
            bots: this.state.bots.map((b) =>
              b.config.type === "ai"
                ? { ...b, portfolio: updatePrices(b.portfolio, { [ticker]: price }) }
                : b
            ),
          }
          this.broadcast()
          return
        }

        const currentAiBot = this.state.bots.find((b) => b.config.type === "ai")
        if (!currentAiBot) return

        const qty = calculateOrderQty(currentAiBot.portfolio, ticker, signal.action, price, signal.confidence * 0.2)
        if (qty === 0) return

        const order: Order = {
          botId: currentAiBot.config.id,
          ticker,
          action: signal.action,
          qty,
          price,
          timestamp: Date.now(),
          confidence: signal.confidence,
          reasoning: signal.reasoning,
        }

        const newPortfolio = executeOrder(
          updatePrices(currentAiBot.portfolio, { [ticker]: price }),
          order
        )

        this.state = {
          ...this.state,
          bots: this.state.bots.map((b) =>
            b.config.type === "ai"
              ? { ...b, portfolio: newPortfolio, lastDecision: order }
              : b
          ),
        }
        this.broadcast()
      }).catch(() => {
        // AI errors are non-fatal — just continue
      })
    }
  }

  // ─── Replay event handlers ───────────────────────────────────────────────────

  private onReplayComplete = (): void => {
    const engine = ReplayEngine.getInstance()
    engine.off("tick", this.onTick)
    const progress = engine.getProgress()
    this.state = {
      ...this.state,
      status: "paused",
      replay: {
        ...this.state.replay,
        barIndex: progress.barIndex,
        totalBars: progress.totalBars,
        isComplete: true,
      },
    }
    this.broadcast()
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private buildInitialState(): SimState {
    const allConfigs: BotConfig[] = [...DEFAULT_BOTS, createAIBotConfig()]
    const bots: BotState[] = allConfigs.map((config) => ({
      config,
      portfolio: createPortfolio(config.id),
      lastDecision: null,
      isActive: true,
    }))

    return {
      status: "idle" as SimStatus,
      bots,
      watchlist: [...WATCHLIST],
      snapshots: {},
      priceHistory: {},
      tickCount: 0,
      startedAt: null,
      replay: {
        mode: "live",
        speed: 1,
        replayDate: null,
        replayTimestamp: null,
        barIndex: 0,
        totalBars: 0,
        isComplete: false,
      },
    }
  }

  private buildGeminiFn() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return undefined
    return createGeminiGenerateFn(apiKey)
  }

  private broadcast(): void {
    StateBroadcaster.getInstance().publish(this.state)
  }

  // ─── Singleton ────────────────────────────────────────────────────────────────

  static getInstance(): Orchestrator {
    if (!globalThis.__orchestrator) {
      globalThis.__orchestrator = new Orchestrator()
    }
    return globalThis.__orchestrator
  }
}
