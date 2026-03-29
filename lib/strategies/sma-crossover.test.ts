import { describe, it, expect } from "vitest"
import { smaCrossoverStrategy } from "./sma-crossover"
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
    ticker: "AAPL",
    bars: makeBars(closes),
    currentPrice: closes[closes.length - 1],
    portfolio: createPortfolio("test"),
    params: { fastPeriod: 5, slowPeriod: 10, ...params },
  }
}

describe("smaCrossoverStrategy", () => {
  it("returns HOLD when insufficient bars for slow SMA", () => {
    const result = smaCrossoverStrategy(makeInput([100, 101, 102], { fastPeriod: 3, slowPeriod: 10 }))
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("returns BUY when fast SMA crosses above slow SMA", () => {
    // Start flat then surge — fast SMA rises above slow
    const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 150]
    const result = smaCrossoverStrategy(makeInput(closes))
    expect(result.action).toBe("BUY")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("returns SELL when fast SMA crosses below slow SMA", () => {
    // Start elevated then drop — fast SMA falls below slow
    const closes = [150, 150, 150, 150, 150, 150, 150, 150, 150, 100]
    const result = smaCrossoverStrategy(makeInput(closes))
    expect(result.action).toBe("SELL")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("returns HOLD for flat prices", () => {
    const closes = Array(15).fill(100)
    const result = smaCrossoverStrategy(makeInput(closes))
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("confidence is clamped to [0, 1]", () => {
    const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 200]
    const result = smaCrossoverStrategy(makeInput(closes))
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("includes reasoning string", () => {
    const closes = Array(12).fill(100)
    const result = smaCrossoverStrategy(makeInput(closes))
    expect(typeof result.reasoning).toBe("string")
    expect(result.reasoning.length).toBeGreaterThan(0)
  })
})
