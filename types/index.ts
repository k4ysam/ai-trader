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

export interface Order {
  botId: string
  ticker: Ticker
  action: TradeAction
  qty: number // shares
  price: number // execution price
  timestamp: number
  reasoning?: string // AI bot only
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

export interface SimState {
  status: SimStatus
  bots: BotState[]
  watchlist: Ticker[]
  snapshots: Record<Ticker, MarketSnapshot>
  priceHistory: Record<Ticker, PriceBar[]>
  tickCount: number
  startedAt: number | null
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
