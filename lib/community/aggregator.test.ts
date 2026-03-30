import { describe, it, expect } from "vitest"
import { computeAggregate, computeCommunityState } from "./aggregator"
import type {
  CommunityBotSnapshot,
  AnonymousTrade,
  Ticker,
} from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snap(overrides: Partial<CommunityBotSnapshot> = {}): CommunityBotSnapshot {
  return {
    sessionId: "sess-1",
    botType: "rsi",
    ticker: "NVDA",
    lastAction: "BUY",
    confidence: 0.8,
    pnlPct: 2.0,
    lastTradeTimestamp: 1000,
    timestamp: Date.now(),
    ...overrides,
  }
}

function trade(overrides: Partial<AnonymousTrade> = {}): AnonymousTrade {
  return {
    ticker: "NVDA",
    action: "BUY",
    botType: "rsi",
    confidence: 0.8,
    timestamp: Date.now(),
    ...overrides,
  }
}

// ─── computeAggregate ─────────────────────────────────────────────────────────

describe("computeAggregate", () => {
  it("returns safe defaults for zero snapshots", () => {
    const agg = computeAggregate("NVDA", [], [])
    expect(agg.ticker).toBe("NVDA")
    expect(agg.totalBots).toBe(0)
    expect(agg.bullPct).toBe(0)
    expect(agg.bearPct).toBe(0)
    expect(agg.holdPct).toBe(0)
    expect(agg.convictionBuckets).toHaveLength(10)
    expect(agg.recentTrades).toHaveLength(0)
  })

  it("computes 100% bull when all bots are BUY", () => {
    const snaps = [
      snap({ lastAction: "BUY" }),
      snap({ lastAction: "BUY", sessionId: "sess-2" }),
      snap({ lastAction: "BUY", sessionId: "sess-3" }),
    ]
    const agg = computeAggregate("NVDA", snaps, [])
    expect(agg.totalBots).toBe(3)
    expect(agg.bullPct).toBe(100)
    expect(agg.bearPct).toBe(0)
    expect(agg.holdPct).toBe(0)
  })

  it("computes mixed bull/bear/hold correctly", () => {
    const snaps = [
      snap({ lastAction: "BUY" }),
      snap({ lastAction: "BUY", sessionId: "sess-2" }),
      snap({ lastAction: "SELL", sessionId: "sess-3" }),
      snap({ lastAction: "HOLD", sessionId: "sess-4" }),
    ]
    const agg = computeAggregate("NVDA", snaps, [])
    expect(agg.bullPct).toBeCloseTo(50)
    expect(agg.bearPct).toBeCloseTo(25)
    expect(agg.holdPct).toBeCloseTo(25)
  })

  it("computes P&L percentiles from snapshots", () => {
    const pnls = [10, 5, 0, -5, -10, 3, 7, 2, -2, 8]
    const snaps = pnls.map((pnl, i) => snap({ pnlPct: pnl, sessionId: `s${i}` }))
    const agg = computeAggregate("NVDA", snaps, [])
    // sorted: -10, -5, -2, 0, 2, 3, 5, 7, 8, 10 (linear interpolation)
    // p25: idx=2.25 → -2 + (0-(-2))*0.25 = -1.5
    // p50: idx=4.5  → 2 + (3-2)*0.5 = 2.5
    // p75: idx=6.75 → 5 + (7-5)*0.75 = 6.5
    // p90: idx=8.1  → 8 + (10-8)*0.1 = 8.2
    expect(agg.pnlPercentiles.p25).toBeCloseTo(-1.5)
    expect(agg.pnlPercentiles.p50).toBeCloseTo(2.5)
    expect(agg.pnlPercentiles.p75).toBeCloseTo(6.5)
    expect(agg.pnlPercentiles.p90).toBeCloseTo(8.2)
  })

  it("fills conviction buckets correctly", () => {
    const snaps = [
      snap({ confidence: 0.05 }), // bucket 0 [0, 0.1)
      snap({ confidence: 0.15, sessionId: "s2" }), // bucket 1
      snap({ confidence: 0.95, sessionId: "s3" }), // bucket 9
    ]
    const agg = computeAggregate("NVDA", snaps, [])
    expect(agg.convictionBuckets[0]).toBe(1)
    expect(agg.convictionBuckets[1]).toBe(1)
    expect(agg.convictionBuckets[9]).toBe(1)
    expect(agg.convictionBuckets.reduce((s, v) => s + v, 0)).toBe(3)
  })

  it("includes only same-ticker trades in recentTrades", () => {
    const trades = [
      trade({ ticker: "NVDA" }),
      trade({ ticker: "AAPL" }), // should NOT appear
      trade({ ticker: "NVDA", action: "SELL" }),
    ]
    const agg = computeAggregate("NVDA", [snap()], trades)
    expect(agg.recentTrades.every((t) => t.ticker === "NVDA")).toBe(true)
    expect(agg.recentTrades).toHaveLength(2)
  })

  it("caps recentTrades at 20", () => {
    const trades = Array.from({ length: 30 }, (_, i) =>
      trade({ timestamp: i })
    )
    const agg = computeAggregate("NVDA", [snap()], trades)
    expect(agg.recentTrades).toHaveLength(20)
  })

  it("computes byStrategy slices per bot type", () => {
    const snaps = [
      snap({ botType: "rsi", lastAction: "BUY", pnlPct: 4 }),
      snap({ botType: "rsi", lastAction: "SELL", sessionId: "s2", pnlPct: -2 }),
      snap({ botType: "momentum", lastAction: "BUY", sessionId: "s3", pnlPct: 6 }),
    ]
    const agg = computeAggregate("NVDA", snaps, [])
    expect(agg.byStrategy.rsi?.count).toBe(2)
    expect(agg.byStrategy.rsi?.bullPct).toBeCloseTo(50)
    expect(agg.byStrategy.momentum?.count).toBe(1)
    expect(agg.byStrategy.momentum?.bullPct).toBe(100)
  })
})

// ─── computeCommunityState ────────────────────────────────────────────────────

describe("computeCommunityState", () => {
  it("produces aggregates for all provided tickers", () => {
    const tickers: Ticker[] = ["NVDA", "AAPL"]
    const snapshotsByTicker = new Map<Ticker, CommunityBotSnapshot[]>([
      ["NVDA", [snap({ ticker: "NVDA" })]],
      ["AAPL", [snap({ ticker: "AAPL", sessionId: "s2" })]],
    ])
    const state = computeCommunityState(snapshotsByTicker, [], tickers)
    expect(state.aggregates["NVDA"]).toBeDefined()
    expect(state.aggregates["AAPL"]).toBeDefined()
    expect(state.totalActiveBots).toBe(2)
  })

  it("counts unique sessions for totalActiveSessions", () => {
    const tickers: Ticker[] = ["NVDA"]
    const snapshotsByTicker = new Map<Ticker, CommunityBotSnapshot[]>([
      [
        "NVDA",
        [
          snap({ sessionId: "sess-a" }),
          snap({ sessionId: "sess-a", botType: "momentum" }), // same session, different bot
          snap({ sessionId: "sess-b" }),
        ],
      ],
    ])
    const state = computeCommunityState(snapshotsByTicker, [], tickers)
    expect(state.totalActiveSessions).toBe(2)
    expect(state.totalActiveBots).toBe(3)
  })

  it("produces empty aggregate for tickers with no snapshots", () => {
    const tickers: Ticker[] = ["NVDA", "TSLA"]
    const snapshotsByTicker = new Map<Ticker, CommunityBotSnapshot[]>([
      ["NVDA", [snap()]],
    ])
    const state = computeCommunityState(snapshotsByTicker, [], tickers)
    expect(state.aggregates["TSLA"]?.totalBots).toBe(0)
  })
})
