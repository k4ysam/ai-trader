// ─── Market Data ────────────────────────────────────────────────────────────

export type Ticker = string

export interface MarketTick {
  ticker: Ticker
  price: number
  timestamp: number
  volume: number
}

export interface MarketSnapshot {
  ticker: Ticker
  price: number
  open: number
  high: number
  low: number
  prevClose: number
  change: number
  changePercent: number
}

export interface PriceBar {
  time: number // unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─── Trading ─────────────────────────────────────────────────────────────────

export type TradeAction = "BUY" | "SELL" | "HOLD"

/** One tool call recorded during an ARIA agent cycle. */
export interface AgentToolCall {
  tool: string
  args: Record<string, unknown>
  result: unknown
  durationMs: number
}

export interface Order {
  botId: string
  ticker: Ticker
  action: TradeAction
  qty: number // shares
  price: number // execution price
  timestamp: number
  confidence: number // 0–1, from strategy signal
  reasoning?: string // AI bot only
  agentTrace?: AgentToolCall[] // tool call sequence for AI agent orders
}

// ─── Portfolio ───────────────────────────────────────────────────────────────

export interface Position {
  ticker: Ticker
  qty: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}

export interface Portfolio {
  botId: string
  cash: number
  positions: Record<Ticker, Position>
  totalValue: number // cash + sum(marketValue)
  totalPnl: number // totalValue - startingBalance
  totalPnlPct: number
  tradeHistory: Order[]
}

// ─── Bots ─────────────────────────────────────────────────────────────────────

export type BotType =
  | "ai"
  | "rsi"
  | "sma-crossover"
  | "momentum"
  | "mean-reversion"
  | "custom"

export interface BotConfig {
  id: string
  name: string
  type: BotType
  color: string
  emoji: string
  params: Record<string, number>
  customCode?: string
}

export interface BotState {
  config: BotConfig
  portfolio: Portfolio
  lastDecision: Order | null
  isActive: boolean
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

export type SSEEventType =
  | "tick"
  | "order"
  | "portfolio"
  | "snapshot"
  | "sim-status"
  | "state"

export interface SSEEvent {
  type: SSEEventType
  payload: unknown
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export type SimStatus = "idle" | "running" | "paused"

export type SimMode = "live" | "replay"
export type ReplaySpeed = 1 | 5 | 10 | 50

export interface ReplayState {
  mode: SimMode
  speed: ReplaySpeed
  replayDate: string | null        // "YYYY-MM-DD" of the data being replayed
  replayTimestamp: number | null   // current simulated epoch ms
  barIndex: number
  totalBars: number
  isComplete: boolean
}

export interface AriaCycle {
  action: TradeAction
  reasoning: string
  ticker: Ticker
  timestamp: number
  trace: AgentToolCall[]
}

export interface SimState {
  status: SimStatus
  bots: BotState[]
  watchlist: Ticker[]
  snapshots: Record<Ticker, MarketSnapshot>
  priceHistory: Record<Ticker, PriceBar[]>
  tickCount: number
  startedAt: number | null
  ariaLastRunAt: number | null
  ariaLastCycle: AriaCycle | null
  replay: ReplayState
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ImportBotPayload {
  name: string
  type: BotType
  params: Record<string, number>
  emoji?: string
  color?: string
}

export interface UpdateBotParamsPayload {
  params: Record<string, number>
}

export interface ApiError {
  error: string
  code?: string
}

// ─── Community Layer ──────────────────────────────────────────────────────────

/** Anonymous snapshot published by one browser session for one bot × ticker. */
export interface CommunityBotSnapshot {
  sessionId: string
  botType: BotType
  ticker: Ticker
  lastAction: TradeAction
  confidence: number          // 0–1
  pnlPct: number              // rounded to nearest 0.5 to prevent fingerprinting
  lastTradeTimestamp: number  // ms unix of most recent trade — used for server-side dedup
  timestamp: number           // ms unix of this heartbeat — used for TTL eviction
}

/** Per-strategy slice within a CommunityAggregate. */
export interface StrategySlice {
  count: number
  bullPct: number
  medianPnlPct: number
}

/** One anonymous trade entry in the community trade feed. */
export interface AnonymousTrade {
  ticker: Ticker
  action: TradeAction
  botType: BotType
  confidence: number
  timestamp: number
}

/** Server-computed rollup for one ticker, broadcast to all clients. */
export interface CommunityAggregate {
  ticker: Ticker
  totalBots: number
  bullPct: number
  bearPct: number
  holdPct: number
  byStrategy: Partial<Record<BotType, StrategySlice>>
  pnlPercentiles: { p25: number; p50: number; p75: number; p90: number }
  convictionBuckets: number[]   // 10 buckets covering [0,0.1) … [0.9,1.0]
  recentTrades: AnonymousTrade[]
  lastUpdated: number
}

/** Top-level state pushed over /api/community/stream every 5 s. */
export interface CommunityState {
  aggregates: Partial<Record<Ticker, CommunityAggregate>>
  totalActiveSessions: number
  totalActiveBots: number
  broadcastAt: number
}

// ─── Community History (Phase 3) ──────────────────────────────────────────────

/** One time-bucketed sentiment snapshot for a ticker, returned by the history route. */
export interface HistoryPoint {
  timestamp: number   // ms unix
  bullPct: number
  bearPct: number
  holdPct: number
  totalBots: number
}
