import { describe, it, expect } from "vitest"
import { momentumStrategy } from "./momentum"
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
    ticker: "TSLA",
    bars: makeBars(closes),
    currentPrice: closes[closes.length - 1],
    portfolio: createPortfolio("test"),
    params: { lookback: 5, threshold: 0.02, ...params },
  }
}

describe("momentumStrategy", () => {
  it("returns HOLD when insufficient bars", () => {
    const result = momentumStrategy(makeInput([100, 101], { lookback: 5 }))
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("returns BUY when price increased above threshold", () => {
    // 100 → 110 over 5 bars = +10%, threshold = 2%
    const closes = [100, 102, 104, 106, 108, 110]
    const result = momentumStrategy(makeInput(closes))
    expect(result.action).toBe("BUY")
    expect(result.confidence).toBeGreaterThan(0)
  })

  it("returns SELL when price decreased below negative threshold", () => {
    const closes = [100, 98, 96, 94, 92, 90]
    const result = momentumStrategy(makeInput(closes))
    expect(result.action).toBe("SELL")
    expect(result.confidence).toBeGreaterThan(0)
  })

  it("returns HOLD when change is within threshold", () => {
    // <2% change
    const closes = [100, 100.2, 100.4, 100.6, 100.8, 101]
    const result = momentumStrategy(makeInput(closes))
    expect(result.action).toBe("HOLD")
  })

  it("confidence is clamped to [0, 1]", () => {
    const closes = [100, 110, 120, 130, 140, 150]
    const result = momentumStrategy(makeInput(closes))
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("includes reasoning string", () => {
    const closes = [100, 101, 102, 103, 104, 105]
    const result = momentumStrategy(makeInput(closes))
    expect(typeof result.reasoning).toBe("string")
    expect(result.reasoning.length).toBeGreaterThan(0)
  })
})
