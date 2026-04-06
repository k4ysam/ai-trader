import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { buildAriaTools } from "@/lib/bots/aria-tools"
import type { AgentToolCall, SimState } from "@/types"
import type { StrategySignal } from "@/lib/strategies/types"

// ─── System prompt ────────────────────────────────────────────────────────────

const ARIA_SYSTEM_PROMPT = `You are ARIA — an AI hedge fund manager with $100,000 to trade across a watchlist of stocks.
Your goal is to maximize portfolio value over time.

Decision protocol — follow this order every cycle:
1. Call get_portfolio() to see your cash, positions, and P&L
2. Call get_price(ticker) to get a fresh quote
3. Optionally call get_analysis(ticker) if you want RSI/trend context
4. Call either place_order() OR hold() — exactly one, exactly once

Rules:
- Never invest more than 20% of your portfolio in one stock (enforced by the system)
- Think contrarian when the data justifies it
- Be concise — reasoning must be one sentence
- Do not call place_order() and hold() in the same cycle`

// ─── Signal extraction ────────────────────────────────────────────────────────

function extractSignalFromTrace(trace: AgentToolCall[]): StrategySignal {
  const fallback: StrategySignal = {
    action: "HOLD",
    confidence: 0,
    reasoning: "No decision made — defaulting to HOLD",
  }

  // Walk trace in reverse to find the last terminal tool call
  for (let i = trace.length - 1; i >= 0; i--) {
    const entry = trace[i]

    if (entry.tool === "hold") {
      const args = entry.args as { reasoning?: string }
      return {
        action: "HOLD",
        confidence: 0,
        reasoning: args.reasoning ?? "HOLD",
      }
    }

    if (entry.tool === "place_order") {
      const result = entry.result as { ok?: boolean; error?: string }
      if (result.ok === false) {
        // Guardrail blocked — treat as HOLD with guardrail message
        return {
          action: "HOLD",
          confidence: 0,
          reasoning: result.error ?? "Order blocked by guardrail",
        }
      }

      const args = entry.args as {
        action?: string
        confidence?: number
        reasoning?: string
      }
      const action = args.action === "BUY" || args.action === "SELL" ? args.action : "HOLD"
      return {
        action,
        confidence: typeof args.confidence === "number" ? args.confidence : 0.5,
        reasoning: args.reasoning ?? action,
      }
    }
  }

  return fallback
}

// ─── runAriaAgent ─────────────────────────────────────────────────────────────
// Runs the ARIA agent tool-use loop for one ticker tick.
// Returns the StrategySignal and the full tool call trace for audit.

export async function runAriaAgent(
  ticker: string,
  price: number,
  timestamp: number,
  getState: () => SimState
): Promise<{ signal: StrategySignal; trace: AgentToolCall[] }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      signal: { action: "HOLD", confidence: 0, reasoning: "GEMINI_API_KEY not configured" },
      trace: [],
    }
  }

  const trace: AgentToolCall[] = []

  try {
    const google = createGoogleGenerativeAI({ apiKey })

    await generateText({
      model: google("gemini-2.0-flash"),
      tools: buildAriaTools({ ticker, price, getState, trace }),
      stopWhen: stepCountIs(5),
      system: ARIA_SYSTEM_PROMPT,
      prompt: `${ticker} is currently at $${price.toFixed(2)}. Analyze and make your trading decision now.`,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected agent error"
    return {
      signal: { action: "HOLD", confidence: 0, reasoning: msg },
      trace,
    }
  }

  return {
    signal: extractSignalFromTrace(trace),
    trace,
  }
}
