import type {
  AnonymousTrade,
  BotType,
  CommunityAggregate,
  CommunityBotSnapshot,
  CommunityState,
  StrategySlice,
  Ticker,
} from "@/types"

// ─── Percentile helper ────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ─── computeAggregate ─────────────────────────────────────────────────────────

/**
 * Compute a CommunityAggregate for a single ticker.
 *
 * @param ticker    - The ticker this aggregate is for
 * @param snapshots - All snapshots for THIS ticker (caller must pre-filter by ticker)
 * @param trades    - All anonymous trades. Filtered internally to `ticker`.
 */
export function computeAggregate(
  ticker: Ticker,
  snapshots: CommunityBotSnapshot[],
  trades: AnonymousTrade[]
): CommunityAggregate {
  const totalBots = snapshots.length
  const now = Date.now()

  // Sentiment counts
  let bulls = 0
  let bears = 0
  let holds = 0
  for (const s of snapshots) {
    if (s.lastAction === "BUY") bulls++
    else if (s.lastAction === "SELL") bears++
    else holds++
  }

  const bullPct = totalBots > 0 ? (bulls / totalBots) * 100 : 0
  const bearPct = totalBots > 0 ? (bears / totalBots) * 100 : 0
  const holdPct = totalBots > 0 ? (holds / totalBots) * 100 : 0

  // P&L percentiles
  const sortedPnl = [...snapshots.map((s) => s.pnlPct)].sort((a, b) => a - b)
  const pnlPercentiles = {
    p25: percentile(sortedPnl, 25),
    p50: percentile(sortedPnl, 50),
    p75: percentile(sortedPnl, 75),
    p90: percentile(sortedPnl, 90),
  }

  // Conviction buckets: 10 buckets covering [0,0.1) … [0.9,1.0]
  const convictionBuckets = Array<number>(10).fill(0)
  for (const s of snapshots) {
    const bucket = Math.min(9, Math.floor(s.confidence * 10))
    convictionBuckets[bucket]++
  }

  // Per-strategy slices
  const byStrategyMap = new Map<BotType, { bulls: number; total: number; pnls: number[] }>()
  for (const s of snapshots) {
    const existing = byStrategyMap.get(s.botType) ?? { bulls: 0, total: 0, pnls: [] }
    existing.total++
    if (s.lastAction === "BUY") existing.bulls++
    existing.pnls.push(s.pnlPct)
    byStrategyMap.set(s.botType, existing)
  }
  const byStrategy: Partial<Record<BotType, StrategySlice>> = {}
  for (const [type, data] of byStrategyMap) {
    const sortedPnls = [...data.pnls].sort((a, b) => a - b)
    byStrategy[type] = {
      count: data.total,
      bullPct: data.total > 0 ? (data.bulls / data.total) * 100 : 0,
      medianPnlPct: percentile(sortedPnls, 50),
    }
  }

  // Recent trades — filter to this ticker, newest first, max 20
  const tickerTrades = trades
    .filter((t) => t.ticker === ticker)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)

  return {
    ticker,
    totalBots,
    bullPct,
    bearPct,
    holdPct,
    byStrategy,
    pnlPercentiles,
    convictionBuckets,
    recentTrades: tickerTrades,
    lastUpdated: now,
  }
}

// ─── computeCommunityState ────────────────────────────────────────────────────

/**
 * Compute the full CommunityState from all snapshots and trades.
 *
 * @param snapshotsByTicker - Map of ticker → snapshots already filtered to that ticker
 * @param trades            - All anonymous trades (unfiltered; computeAggregate filters internally)
 * @param tickers           - Full watchlist — produces an aggregate entry for every ticker
 */
export function computeCommunityState(
  snapshotsByTicker: Map<Ticker, CommunityBotSnapshot[]>,
  trades: AnonymousTrade[],
  tickers: Ticker[]
): CommunityState {
  const aggregates: Partial<Record<Ticker, CommunityAggregate>> = {}
  let totalActiveBots = 0
  const sessionIds = new Set<string>()

  for (const ticker of tickers) {
    const snaps = snapshotsByTicker.get(ticker) ?? []
    aggregates[ticker] = computeAggregate(ticker, snaps, trades)
    totalActiveBots += snaps.length
    for (const s of snaps) sessionIds.add(s.sessionId)
  }

  return {
    aggregates,
    totalActiveSessions: sessionIds.size,
    totalActiveBots,
    broadcastAt: Date.now(),
  }
}
