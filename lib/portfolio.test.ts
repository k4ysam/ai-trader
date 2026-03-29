import { describe, it, expect } from "vitest"
import {
  createPortfolio,
  executeOrder,
  updatePrices,
  calculateOrderQty,
} from "./portfolio"
import type { Order } from "@/types"

const STARTING_BALANCE = 100_000

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    botId: "test-bot",
    ticker: "NVDA",
    action: "BUY",
    qty: 10,
    price: 100,
    timestamp: Date.now(),
    ...overrides,
  }
}

// ─── createPortfolio ──────────────────────────────────────────────────────────

describe("createPortfolio", () => {
  it("initialises with correct cash and empty positions", () => {
    const p = createPortfolio("bot-1")
    expect(p.botId).toBe("bot-1")
    expect(p.cash).toBe(STARTING_BALANCE)
    expect(p.positions).toEqual({})
    expect(p.tradeHistory).toEqual([])
    expect(p.totalValue).toBe(STARTING_BALANCE)
    expect(p.totalPnl).toBe(0)
    expect(p.totalPnlPct).toBe(0)
  })
})

// ─── executeOrder — BUY ───────────────────────────────────────────────────────

describe("executeOrder BUY", () => {
  it("creates a new position and deducts cash", () => {
    const p = createPortfolio("bot-1")
    const order = makeOrder({ qty: 10, price: 100 }) // cost = $1000
    const next = executeOrder(p, order)

    expect(next.cash).toBe(STARTING_BALANCE - 1000)
    expect(next.positions["NVDA"]).toMatchObject({
      ticker: "NVDA",
      qty: 10,
      avgCost: 100,
      currentPrice: 100,
      marketValue: 1000,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
    })
    expect(next.tradeHistory).toHaveLength(1)
  })

  it("adds to existing position and blends avgCost", () => {
    const p = createPortfolio("bot-1")
    const first = executeOrder(p, makeOrder({ qty: 10, price: 100 })) // avg = 100
    const second = executeOrder(first, makeOrder({ qty: 10, price: 200 })) // avg = 150

    expect(second.positions["NVDA"].qty).toBe(20)
    expect(second.positions["NVDA"].avgCost).toBeCloseTo(150)
  })

  it("rejects BUY when insufficient cash and returns unchanged portfolio", () => {
    const p = createPortfolio("bot-1")
    const order = makeOrder({ qty: 2000, price: 1000 }) // $2M — way more than $100k
    const next = executeOrder(p, order)

    expect(next.cash).toBe(STARTING_BALANCE) // unchanged
    expect(next.positions).toEqual({}) // no position created
    expect(next.tradeHistory).toHaveLength(0)
  })

  it("does not mutate original portfolio", () => {
    const p = createPortfolio("bot-1")
    const original_cash = p.cash
    executeOrder(p, makeOrder({ qty: 10, price: 100 }))
    expect(p.cash).toBe(original_cash)
  })
})

// ─── executeOrder — SELL ──────────────────────────────────────────────────────

describe("executeOrder SELL", () => {
  it("closes position and returns cash", () => {
    const p = createPortfolio("bot-1")
    const bought = executeOrder(p, makeOrder({ qty: 10, price: 100 }))
    const sold = executeOrder(bought, makeOrder({ action: "SELL", qty: 10, price: 120 }))

    expect(sold.positions["NVDA"]).toBeUndefined() // position removed
    expect(sold.cash).toBe(STARTING_BALANCE - 1000 + 1200) // bought $1k, sold $1.2k
    expect(sold.tradeHistory).toHaveLength(2)
  })

  it("rejects SELL when no position exists", () => {
    const p = createPortfolio("bot-1")
    const order = makeOrder({ action: "SELL", qty: 5, price: 100 })
    const next = executeOrder(p, order)

    expect(next.cash).toBe(STARTING_BALANCE)
    expect(next.tradeHistory).toHaveLength(0)
  })

  it("rejects SELL when qty exceeds position", () => {
    const p = createPortfolio("bot-1")
    const bought = executeOrder(p, makeOrder({ qty: 5, price: 100 }))
    const over = executeOrder(bought, makeOrder({ action: "SELL", qty: 10, price: 100 }))

    expect(over.positions["NVDA"].qty).toBe(5) // unchanged
  })
})

// ─── executeOrder — HOLD ──────────────────────────────────────────────────────

describe("executeOrder HOLD", () => {
  it("returns identical portfolio on HOLD", () => {
    const p = createPortfolio("bot-1")
    const next = executeOrder(p, makeOrder({ action: "HOLD", qty: 0 }))
    expect(next).toEqual(p)
  })
})

// ─── updatePrices ─────────────────────────────────────────────────────────────

describe("updatePrices", () => {
  it("recalculates position values correctly", () => {
    const p = createPortfolio("bot-1")
    const bought = executeOrder(p, makeOrder({ qty: 10, price: 100 })) // avg cost = 100

    const updated = updatePrices(bought, { NVDA: 150 })

    expect(updated.positions["NVDA"].currentPrice).toBe(150)
    expect(updated.positions["NVDA"].marketValue).toBe(1500)
    expect(updated.positions["NVDA"].unrealizedPnl).toBeCloseTo(500)
    expect(updated.positions["NVDA"].unrealizedPnlPct).toBeCloseTo(50)
  })

  it("updates totalValue and totalPnl", () => {
    const p = createPortfolio("bot-1")
    const bought = executeOrder(p, makeOrder({ qty: 10, price: 100 }))
    const updated = updatePrices(bought, { NVDA: 150 })

    expect(updated.totalValue).toBe(updated.cash + 1500)
    expect(updated.totalPnl).toBe(updated.totalValue - STARTING_BALANCE)
    expect(updated.totalPnlPct).toBeCloseTo(
      ((updated.totalValue - STARTING_BALANCE) / STARTING_BALANCE) * 100
    )
  })

  it("ignores price updates for tickers not in portfolio", () => {
    const p = createPortfolio("bot-1")
    const updated = updatePrices(p, { AAPL: 200 })
    expect(updated.totalValue).toBe(STARTING_BALANCE)
  })

  it("does not mutate original portfolio", () => {
    const p = createPortfolio("bot-1")
    const bought = executeOrder(p, makeOrder({ qty: 10, price: 100 }))
    const before = bought.positions["NVDA"].currentPrice
    updatePrices(bought, { NVDA: 999 })
    expect(bought.positions["NVDA"].currentPrice).toBe(before)
  })
})

// ─── calculateOrderQty ────────────────────────────────────────────────────────

describe("calculateOrderQty", () => {
  it("returns 0 for HOLD", () => {
    const p = createPortfolio("bot-1")
    expect(calculateOrderQty(p, "NVDA", "HOLD", 100, 0.1)).toBe(0)
  })

  it("calculates correct BUY qty for size pct", () => {
    const p = createPortfolio("bot-1")
    // 10% of $100k = $10k / $100 per share = 100 shares
    const qty = calculateOrderQty(p, "NVDA", "BUY", 100, 0.1)
    expect(qty).toBe(100)
  })

  it("caps BUY qty at MAX_POSITION_PCT (20%)", () => {
    const p = createPortfolio("bot-1")
    // Requesting 50% but cap is 20% → 20k / 100 = 200 shares
    const qty = calculateOrderQty(p, "NVDA", "BUY", 100, 0.5)
    expect(qty).toBe(200)
  })

  it("returns floor for fractional shares", () => {
    const p = createPortfolio("bot-1")
    // 10% of $100k = $10k / $333 = 30.03 → floors to 30
    const qty = calculateOrderQty(p, "NVDA", "BUY", 333, 0.1)
    expect(qty).toBe(30)
  })

  it("returns 0 BUY when price is 0", () => {
    const p = createPortfolio("bot-1")
    expect(calculateOrderQty(p, "NVDA", "BUY", 0, 0.1)).toBe(0)
  })

  it("returns full position qty for SELL", () => {
    const p = createPortfolio("bot-1")
    const bought = executeOrder(p, makeOrder({ qty: 25, price: 100 }))
    const qty = calculateOrderQty(bought, "NVDA", "SELL", 120, 1.0)
    expect(qty).toBe(25)
  })

  it("returns 0 SELL when no position", () => {
    const p = createPortfolio("bot-1")
    expect(calculateOrderQty(p, "NVDA", "SELL", 100, 1.0)).toBe(0)
  })
})
