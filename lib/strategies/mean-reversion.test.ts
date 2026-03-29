import { describe, it, expect } from "vitest"
import { meanReversionStrategy } from "./mean-reversion"
import { createPortfolio } from "@/lib/portfolio"
import type { StrategyInput } from "./types"
import type { PriceBar } from "@/types"

function makeBars(closes: number[]): PriceBar[] {
  return closes.map((c, i) => ({
    time: i * 60_000,
    open: c,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000,
  }))
}

function makeInput(closes: number[], params = {}): StrategyInput {
  return {
    ticker: "MSFT",
    bars: makeBars(closes),
    currentPrice: closes[closes.length - 1],
    portfolio: createPortfolio("test"),
    params: { period: 5, stdDevMultiplier: 2.0, ...params },
  }
}

describe("meanReversionStrategy", () => {
  it("returns HOLD when insufficient bars", () => {
    const result = meanReversionStrategy(makeInput([100, 101], { period: 5 }))
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("returns BUY when price is below mean - 2σ", () => {
    // 9 bars at 100, final bar drops to 60:
    // mean=96, stddev=12, lowerBand=72 → 60 < 72 → BUY
    const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 60]
    const result = meanReversionStrategy(makeInput(closes, { period: 10, stdDevMultiplier: 2.0 }))
    expect(result.action).toBe("BUY")
    expect(result.confidence).toBeGreaterThan(0)
  })

  it("returns SELL when price is above mean + 2σ", () => {
    // 9 bars at 100, final bar spikes to 160:
    // mean=106, stddev=18, upperBand=142 → 160 > 142 → SELL
    const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 160]
    const result = meanReversionStrategy(makeInput(closes, { period: 10, stdDevMultiplier: 2.0 }))
    expect(result.action).toBe("SELL")
    expect(result.confidence).toBeGreaterThan(0)
  })

  it("returns HOLD for flat prices (all same value)", () => {
    const closes = Array(10).fill(100)
    const result = meanReversionStrategy(makeInput(closes))
    // stddev = 0, no band to break — should HOLD
    expect(result.action).toBe("HOLD")
  })

  it("confidence is clamped to [0, 1]", () => {
    const closes = [100, 100, 100, 100, 10]
    const result = meanReversionStrategy(makeInput(closes))
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("includes reasoning string", () => {
    const closes = [100, 101, 102, 103, 104]
    const result = meanReversionStrategy(makeInput(closes))
    expect(typeof result.reasoning).toBe("string")
    expect(result.reasoning.length).toBeGreaterThan(0)
  })
})
