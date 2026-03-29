import { GoogleGenAI } from "@google/genai"
import { MODEL_ID } from "@/lib/constants"
import type { BotConfig, MarketSnapshot, Order, PriceBar, Portfolio, Ticker, TradeAction } from "@/types"
import type { StrategyInput, StrategySignal } from "@/lib/strategies/types"

// ─── System Prompt ────────────────────────────────────────────────────────────

const ARIA_SYSTEM_PROMPT = `You are ARIA — an AI hedge fund manager with $100,000 to trade across a watchlist of stocks.
Your goal is to maximize portfolio value over time.
You will receive real-time market data and must decide for ONE stock: BUY, SELL, or HOLD.

Rules:
- Never invest more than 20% of your portfolio in one stock
- You can see what rule-based bots recently did — you don't have to agree with them
- Think contrarian when the data justifies it
- Be concise in your reasoning (one sentence max)

Respond with ONLY valid JSON. No markdown, no prose, no code fences:
{"action":"BUY"|"SELL"|"HOLD","confidence":0.0-1.0,"reasoning":"one sentence"}`

// ─── parseAISignal ────────────────────────────────────────────────────────────

const VALID_ACTIONS: Set<string> = new Set(["BUY", "SELL", "HOLD"])

export function parseAISignal(raw: unknown): StrategySignal {
  const fallback: StrategySignal = { action: "HOLD", confidence: 0, reasoning: "Parse error — defaulting to HOLD" }

  if (typeof raw !== "object" || raw === null) return fallback

  const r = raw as Record<string, unknown>

  if (typeof r.action !== "string" || !VALID_ACTIONS.has(r.action)) return fallback
  if (typeof r.confidence !== "number") return fallback
  if (typeof r.reasoning !== "string") return fallback

  return {
    action: r.action as TradeAction,
    confidence: Math.min(1, Math.max(0, r.confidence)),
    reasoning: r.reasoning,
  }
}

// ─── buildMarketContext ───────────────────────────────────────────────────────

export function buildMarketContext(
  ticker: Ticker,
  bars: PriceBar[],
  snapshot: MarketSnapshot,
  portfolio: Portfolio,
  recentOrders: Order[]
): string {
  const recentBars = bars.slice(-10)
  const barSummary = recentBars
    .map((b) => `  open=${b.open.toFixed(2)} close=${b.close.toFixed(2)} vol=${b.volume}`)
    .join("\n")

  const position = portfolio.positions[ticker]
  const positionSummary = position
    ? `Holding ${position.qty} shares @ avg $${position.avgCost.toFixed(2)}, P&L: $${position.unrealizedPnl.toFixed(2)}`
    : "No position"

  const recentBotTrades = recentOrders
    .slice(-3)
    .map((o) => `  ${o.botId}: ${o.action} ${o.qty} ${o.ticker} @ $${o.price.toFixed(2)}`)
    .join("\n")

  return [
    `TICKER: ${ticker}`,
    `Current price: $${snapshot.price.toFixed(2)} (${snapshot.changePercent >= 0 ? "+" : ""}${snapshot.changePercent.toFixed(2)}% today)`,
    `Open: $${snapshot.open.toFixed(2)}  High: $${snapshot.high.toFixed(2)}  Low: $${snapshot.low.toFixed(2)}`,
    ``,
    `Last ${recentBars.length} 1-min bars (oldest first):`,
    barSummary,
    ``,
    `Your position in ${ticker}: ${positionSummary}`,
    `Available cash: $${portfolio.cash.toFixed(2)}`,
    `Portfolio total value: $${portfolio.totalValue.toFixed(2)} (${portfolio.totalPnlPct >= 0 ? "+" : ""}${portfolio.totalPnlPct.toFixed(2)}% overall)`,
    ``,
    recentBotTrades
      ? `Recent trades by other bots:\n${recentBotTrades}`
      : "No recent bot trades.",
  ].join("\n")
}

// ─── generateWithGemini ──────────────────────────────────────────────────────
// Extracted so tests can inject a mock without fighting ESM module mocking.

export type GeminiGenerateFn = (prompt: string) => Promise<string>

export function createGeminiGenerateFn(apiKey: string): GeminiGenerateFn {
  const ai = new GoogleGenAI({ apiKey })
  return async (prompt: string): Promise<string> => {
    const result = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: ARIA_SYSTEM_PROMPT,
        maxOutputTokens: 256,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
        httpOptions: { retryOptions: { attempts: 3 } },
      },
    })
    return result.text ?? ""
  }
}

// ─── callAIBot ────────────────────────────────────────────────────────────────

export async function callAIBot(
  ticker: Ticker,
  input: StrategyInput,
  snapshot: MarketSnapshot,
  recentOrders: Order[],
  generateFn?: GeminiGenerateFn
): Promise<StrategySignal> {
  const holdFallback: StrategySignal = {
    action: "HOLD",
    confidence: 0,
    reasoning: "AI bot error — defaulting to HOLD",
  }

  try {
    const userMessage = buildMarketContext(ticker, input.bars, snapshot, input.portfolio, recentOrders)

    let generate = generateFn
    if (!generate) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return { ...holdFallback, reasoning: "GEMINI_API_KEY not configured" }
      }
      generate = createGeminiGenerateFn(apiKey)
    }

    const text = (await generate(userMessage)).trim()
    // Strip code fences if present
    const stripped = text.startsWith("```")
      ? text.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "")
      : text

    let parsed: unknown
    try {
      parsed = JSON.parse(stripped)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) return { ...holdFallback, reasoning: "No JSON in AI response" }
      parsed = JSON.parse(match[0])
    }

    return parseAISignal(parsed)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected AI error"
    return { ...holdFallback, reasoning: msg }
  }
}

// ─── createAIBotConfig ────────────────────────────────────────────────────────

export function createAIBotConfig(): BotConfig {
  return {
    id: "aria-ai-bot",
    name: "ARIA",
    type: "ai",
    emoji: "🤖",
    color: "#8b5cf6",
    params: {},
  }
}
