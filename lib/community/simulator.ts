import type {
  AnonymousTrade,
  BotType,
  CommunityBotSnapshot,
  CommunityState,
  MarketSnapshot,
  Ticker,
  TradeAction,
} from "@/types"
import { WATCHLIST } from "@/lib/constants"
import { computeCommunityState } from "./aggregator"
import { CommunityBroadcaster } from "./broadcaster"

// ─── Singleton guard ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __communitySimulator: CommunitySimulator | undefined
  // eslint-disable-next-line no-var
  var __communitySimInterval: ReturnType<typeof setInterval> | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMUNITY_SESSIONS = 847
const BOT_COUNT_MIN = 2
const BOT_COUNT_MAX = 6

/** Strategy distribution weights. Must sum to 1. */
const STRATEGY_WEIGHTS: { type: BotType; weight: number }[] = [
  { type: "rsi", weight: 0.27 },
  { type: "sma-crossover", weight: 0.21 },
  { type: "momentum", weight: 0.17 },
  { type: "mean-reversion", weight: 0.15 },
  { type: "ai", weight: 0.15 },
  { type: "custom", weight: 0.05 },
]

// ─── Seeded pseudo-random (deterministic per session) ────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ─── Weighted random choice ───────────────────────────────────────────────────

function weightedChoice<T>(items: { value: T; weight: number }[], rand: number): T {
  let cumulative = 0
  for (const item of items) {
    cumulative += item.weight
    if (rand < cumulative) return item.value
  }
  return items[items.length - 1].value
}

// ─── Normal approximation using Box-Muller (pure) ────────────────────────────

function normalSample(mean: number, std: number, r1: number, r2: number): number {
  const z = Math.sqrt(-2 * Math.log(Math.max(r1, 1e-10))) * Math.cos(2 * Math.PI * r2)
  return mean + std * z
}

// ─── CommunitySimulator ───────────────────────────────────────────────────────

export class CommunitySimulator {
  /** Recent community trades (bounded at 200 entries). */
  private trades: AnonymousTrade[] = []

  /**
   * Per-session snapshots keyed by `${sessionId}:${botType}:${ticker}`.
   * Rebuilt each tick to reflect market direction shifts.
   */
  private snapshots: Map<string, CommunityBotSnapshot> = new Map()

  /** Initial PnL seeded per session (stable between ticks). */
  private sessionPnlSeeds: Map<string, number> = new Map()

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Start the internal tick loop.
   * Idempotent — safe to call multiple times. Uses globalThis to survive HMR.
   */
  start(): void {
    if (globalThis.__communitySimInterval) {
      clearInterval(globalThis.__communitySimInterval)
    }
    const interval = setInterval(() => this.tick(), 5_000)
    globalThis.__communitySimInterval = interval
    // Initial tick to populate state immediately
    this.tick()
  }

  stop(): void {
    if (globalThis.__communitySimInterval) {
      clearInterval(globalThis.__communitySimInterval)
      globalThis.__communitySimInterval = undefined
    }
  }

  // ─── Tick ────────────────────────────────────────────────────────────────────

  private tick(): void {
    // Lazy import to avoid circular dep at module load time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Orchestrator } = require("@/lib/orchestrator") as typeof import("@/lib/orchestrator")
    const marketSnapshots = Orchestrator.getInstance().getState().snapshots

    // Guard: if sim hasn't started yet, no price data → skip
    if (Object.keys(marketSnapshots).length === 0) return

    this.regenerateSnapshots(marketSnapshots)
    this.maybeAddTrades()

    const snapshotsByTicker = this.groupByTicker()
    const state = computeCommunityState(snapshotsByTicker, this.trades, WATCHLIST)
    CommunityBroadcaster.getInstance().publish(state)
  }

  // ─── Snapshot generation ─────────────────────────────────────────────────────

  private regenerateSnapshots(marketSnapshots: Record<Ticker, MarketSnapshot>): void {
    const tickers = Object.keys(marketSnapshots) as Ticker[]
    if (tickers.length === 0) return

    const now = Date.now()

    for (let i = 0; i < COMMUNITY_SESSIONS; i++) {
      const rng = seededRandom(i * 31337 + Math.floor(now / 30_000)) // shift every 30s
      const sessionId = `sim-sess-${i}`

      // Stable PnL seed per session
      if (!this.sessionPnlSeeds.has(sessionId)) {
        const r1 = rng()
        const r2 = rng()
        this.sessionPnlSeeds.set(sessionId, normalSample(0.02, 0.12, r1, r2))
      }
      const basePnl = this.sessionPnlSeeds.get(sessionId)!

      const botCount = BOT_COUNT_MIN + Math.floor(rng() * (BOT_COUNT_MAX - BOT_COUNT_MIN + 1))

      for (let b = 0; b < botCount; b++) {
        const botType = weightedChoice(
          STRATEGY_WEIGHTS.map((s) => ({ value: s.type, weight: s.weight })),
          rng()
        )

        // Pick a ticker for this bot
        const ticker = tickers[Math.floor(rng() * tickers.length)]
        const snap = marketSnapshots[ticker]

        // Determine action based on strategy type + market direction + noise
        const action = this.simulateAction(botType, snap, rng)
        const confidence = 0.3 + rng() * 0.7
        // Slightly vary PnL per bot
        const pnlNoise = normalSample(0, 0.05, rng(), rng())
        const rawPnl = basePnl + pnlNoise
        // Round to nearest 0.5 for privacy
        const pnlPct = Math.round(rawPnl * 200) / 200 * 100 / 100

        const key = `${sessionId}:${botType}:${ticker}`
        this.snapshots.set(key, {
          sessionId,
          botType,
          ticker,
          lastAction: action,
          confidence,
          pnlPct,
          lastTradeTimestamp: now - Math.floor(rng() * 60_000),
          timestamp: now,
        })
      }
    }
  }

  private simulateAction(
    botType: BotType,
    snap: MarketSnapshot,
    rng: () => number
  ): TradeAction {
    const rand = rng()
    const changeSign = snap.changePercent >= 0 ? 1 : -1

    // Strategy-specific biases toward market direction
    switch (botType) {
      case "momentum":
        // Momentum bots follow the trend
        return rand < 0.5 + changeSign * 0.2 ? "BUY" : rand < 0.8 ? "HOLD" : "SELL"
      case "mean-reversion":
        // Mean-reversion bots bet against the trend
        return rand < 0.5 - changeSign * 0.2 ? "SELL" : rand < 0.75 ? "HOLD" : "BUY"
      case "rsi":
        // RSI bots tend toward contrarian after large moves
        return rand < 0.38 ? "BUY" : rand < 0.62 ? "HOLD" : "SELL"
      case "sma-crossover":
        // SMA bots are slow to react — mostly HOLD
        return rand < 0.3 ? "BUY" : rand < 0.6 ? "HOLD" : "SELL"
      case "ai":
        // AI bots are slightly bullish on average (reflect LLM optimism bias)
        return rand < 0.42 ? "BUY" : rand < 0.68 ? "HOLD" : "SELL"
      default:
        return rand < 0.35 ? "BUY" : rand < 0.65 ? "HOLD" : "SELL"
    }
  }

  // ─── Trade generation ────────────────────────────────────────────────────────

  private maybeAddTrades(): void {
    // Generate 1–3 synthetic trades per tick to populate the feed
    const rng = seededRandom(Date.now())
    const count = 1 + Math.floor(rng() * 3)
    const snapEntries = [...this.snapshots.values()]
    if (snapEntries.length === 0) return

    for (let i = 0; i < count; i++) {
      const snap = snapEntries[Math.floor(rng() * snapEntries.length)]
      if (snap.lastAction === "HOLD") continue

      const trade: AnonymousTrade = {
        ticker: snap.ticker,
        action: snap.lastAction,
        botType: snap.botType,
        confidence: snap.confidence,
        timestamp: Date.now() - Math.floor(rng() * 5_000),
      }
      this.trades.unshift(trade)
    }

    // Bound list size
    if (this.trades.length > 200) {
      this.trades = this.trades.slice(0, 200)
    }
  }

  // ─── Grouping ────────────────────────────────────────────────────────────────

  private groupByTicker(): Map<Ticker, CommunityBotSnapshot[]> {
    const map = new Map<Ticker, CommunityBotSnapshot[]>()
    for (const snap of this.snapshots.values()) {
      const existing = map.get(snap.ticker) ?? []
      existing.push(snap)
      map.set(snap.ticker, existing)
    }
    return map
  }

  // ─── Singleton ───────────────────────────────────────────────────────────────

  static getInstance(): CommunitySimulator {
    if (!globalThis.__communitySimulator) {
      globalThis.__communitySimulator = new CommunitySimulator()
    }
    return globalThis.__communitySimulator
  }
}
