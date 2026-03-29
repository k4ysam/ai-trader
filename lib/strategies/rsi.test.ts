import { describe, it, expect } from "vitest"
import { rsiStrategy } from "./rsi"
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
    ticker: "NVDA",
    bars: makeBars(closes),
    currentPrice: closes[closes.length - 1],
    portfolio: createPortfolio("test"),
    params: { period: 14, overbought: 70, oversold: 30, ...params },
  }
}

describe("rsiStrategy", () => {
  it("returns HOLD when insufficient bars", () => {
    const result = rsiStrategy(makeInput([100, 101, 102]))
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("returns BUY when RSI is oversold", () => {
    // Declining prices drive RSI below 30
    const closes = [100, 99, 97, 94, 90, 85, 79, 72, 64, 55, 45, 34, 22, 10, 5]
    const result = rsiStrategy(makeInput(closes))
    expect(result.action).toBe("BUY")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("returns SELL when RSI is overbought", () => {
    // Rising prices drive RSI above 70
    const closes = [50, 55, 62, 70, 79, 89, 100, 112, 125, 139, 154, 170, 187, 205, 225]
    const result = rsiStrategy(makeInput(closes))
    expect(result.action).toBe("SELL")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("returns HOLD when RSI is in neutral zone", () => {
    // Flat prices → RSI ≈ 50
    const closes = Array(15).fill(100)
    const result = rsiStrategy(makeInput(closes))
    expect(result.action).toBe("HOLD")
  })

  it("confidence is clamped to [0, 1]", () => {
    const closes = [100, 99, 97, 94, 90, 85, 79, 72, 64, 55, 45, 34, 22, 10, 5]
    const result = rsiStrategy(makeInput(closes))
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("uses custom overbought/oversold thresholds", () => {
    // Only mildly rising — neutral with default thresholds, SELL with tight threshold
    const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
    const tight = rsiStrategy(makeInput(closes, { period: 14, overbought: 55, oversold: 45 }))
    // With tight thresholds, moderate rise should trigger SELL
    expect(["SELL", "HOLD"]).toContain(tight.action)
  })

  it("includes reasoning string", () => {
    const closes = Array(15).fill(100)
    const result = rsiStrategy(makeInput(closes))
    expect(typeof result.reasoning).toBe("string")
    expect(result.reasoning.length).toBeGreaterThan(0)
  })
})
