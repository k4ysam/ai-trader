import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createPortfolio } from "@/lib/portfolio"
import type { StrategyInput } from "@/lib/strategies/types"
import type { PriceBar, MarketSnapshot } from "@/types"
import { parseAISignal, buildMarketContext, callAIBot, createAIBotConfig } from "./ai-bot"
import type { GeminiGenerateFn } from "./ai-bot"

// No module mocking needed — callAIBot accepts an injectable generateFn

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBars(n: number): PriceBar[] {
  return Array.from({ length: n }, (_, i) => ({
    time: i * 60_000,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 10_000,
  }))
}

function makeSnapshot(ticker: string): MarketSnapshot {
  return { ticker, price: 150, open: 148, high: 152, low: 147, prevClose: 148, change: 2, changePercent: 1.35 }
}

function makeInput(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    ticker: "NVDA",
    bars: makeBars(10),
    currentPrice: 110,
    portfolio: createPortfolio("ai-bot"),
    params: {},
    ...overrides,
  }
}

// ─── parseAISignal ────────────────────────────────────────────────────────────

describe("parseAISignal", () => {
  it("parses valid BUY signal", () => {
    const result = parseAISignal({ action: "BUY", confidence: 0.8, reasoning: "bullish" })
    expect(result).toMatchObject({ action: "BUY", confidence: 0.8, reasoning: "bullish" })
  })

  it("parses valid SELL signal", () => {
    const result = parseAISignal({ action: "SELL", confidence: 0.6, reasoning: "bearish" })
    expect(result.action).toBe("SELL")
  })

  it("clamps confidence above 1 to 1", () => {
    const result = parseAISignal({ action: "BUY", confidence: 1.5, reasoning: "x" })
    expect(result.confidence).toBe(1)
  })

  it("clamps confidence below 0 to 0", () => {
    const result = parseAISignal({ action: "SELL", confidence: -0.3, reasoning: "x" })
    expect(result.confidence).toBe(0)
  })

  it("falls back to HOLD on invalid action", () => {
    const result = parseAISignal({ action: "MAYBE", confidence: 0.5, reasoning: "x" })
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("falls back to HOLD on null input", () => {
    const result = parseAISignal(null)
    expect(result.action).toBe("HOLD")
  })

  it("falls back to HOLD on missing confidence", () => {
    const result = parseAISignal({ action: "BUY", reasoning: "x" })
    expect(result.action).toBe("HOLD")
  })
})

// ─── buildMarketContext ───────────────────────────────────────────────────────

describe("buildMarketContext", () => {
  it("returns a non-empty string", () => {
    const ctx = buildMarketContext("NVDA", makeBars(10), makeSnapshot("NVDA"), createPortfolio("ai"), [])
    expect(typeof ctx).toBe("string")
    expect(ctx.length).toBeGreaterThan(50)
  })

  it("includes ticker and current price", () => {
    const ctx = buildMarketContext("NVDA", makeBars(10), makeSnapshot("NVDA"), createPortfolio("ai"), [])
    expect(ctx).toContain("NVDA")
    expect(ctx).toContain("150")
  })

  it("includes portfolio cash", () => {
    const ctx = buildMarketContext("NVDA", makeBars(10), makeSnapshot("NVDA"), createPortfolio("ai"), [])
    expect(ctx).toContain("100000")
  })
})

// ─── callAIBot ────────────────────────────────────────────────────────────────

describe("callAIBot", () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY
  })

  it("returns parsed signal from valid Gemini response", async () => {
    const mockGenerate: GeminiGenerateFn = vi.fn().mockResolvedValue(
      JSON.stringify({ action: "BUY", confidence: 0.75, reasoning: "positive momentum" })
    )
    const result = await callAIBot("NVDA", makeInput(), makeSnapshot("NVDA"), [], mockGenerate)
    expect(result.action).toBe("BUY")
    expect(result.confidence).toBeCloseTo(0.75)
    expect(result.reasoning).toBe("positive momentum")
  })

  it("returns HOLD on Gemini API error", async () => {
    const mockGenerate: GeminiGenerateFn = vi.fn().mockRejectedValue(new Error("Rate limit"))
    const result = await callAIBot("NVDA", makeInput(), makeSnapshot("NVDA"), [], mockGenerate)
    expect(result.action).toBe("HOLD")
    expect(result.confidence).toBe(0)
  })

  it("returns HOLD on malformed JSON response", async () => {
    const mockGenerate: GeminiGenerateFn = vi.fn().mockResolvedValue("not json at all")
    const result = await callAIBot("NVDA", makeInput(), makeSnapshot("NVDA"), [], mockGenerate)
    expect(result.action).toBe("HOLD")
  })

  it("returns HOLD when API key is missing and no generateFn injected", async () => {
    delete process.env.GEMINI_API_KEY
    const result = await callAIBot("NVDA", makeInput(), makeSnapshot("NVDA"), [])
    expect(result.action).toBe("HOLD")
    expect(result.reasoning).toContain("GEMINI_API_KEY")
  })

  it("strips markdown code fences from response", async () => {
    const mockGenerate: GeminiGenerateFn = vi.fn().mockResolvedValue(
      "```json\n{\"action\":\"SELL\",\"confidence\":0.9,\"reasoning\":\"overbought\"}\n```"
    )
    const result = await callAIBot("NVDA", makeInput(), makeSnapshot("NVDA"), [], mockGenerate)
    expect(result.action).toBe("SELL")
  })
})

// ─── createAIBotConfig ────────────────────────────────────────────────────────

describe("createAIBotConfig", () => {
  it("returns a valid BotConfig with type ai", () => {
    const config = createAIBotConfig()
    expect(config.type).toBe("ai")
    expect(config.id).toBe("aria-ai-bot")
    expect(typeof config.name).toBe("string")
  })
})
