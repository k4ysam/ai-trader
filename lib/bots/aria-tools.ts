import { tool } from "ai"
import { z } from "zod"
import { MAX_POSITION_PCT } from "@/lib/constants"
import type { AgentToolCall, PriceBar, SimState } from "@/types"

// ─── Guardrail config ─────────────────────────────────────────────────────────

const GUARDRAILS = {
  minCashReserve: 500,     // always keep $500 cash
  maxDailyLossPct: 0.05,   // halt new buys if down >5%
} as const

// ─── Context passed to all tool executors ─────────────────────────────────────

export interface AriaToolsContext {
  ticker: string
  price: number
  getState: () => SimState
  trace: AgentToolCall[]
}

// ─── buildAriaTools ───────────────────────────────────────────────────────────
// Returns the 5 tool definitions wired to the live simulation state.
// Tools are pure readers — no portfolio mutations happen here.
// place_order and hold record the agent's decision in trace; the orchestrator
// reads trace after the loop and executes the order itself.

export function buildAriaTools(ctx: AriaToolsContext) {
  return {
    get_portfolio: tool({
      description:
        "Get the current portfolio: cash balance, open positions, and P&L. " +
        "Always call this first before making any trade decision.",
      inputSchema: z.object({}),
      execute: async () => {
        const t0 = Date.now()
        const state = ctx.getState()
        const bot = state.bots.find((b) => b.config.type === "ai")
        if (!bot) {
          const result = { ok: false, error: "AI bot not found in state" }
          ctx.trace.push({ tool: "get_portfolio", args: {}, result, durationMs: Date.now() - t0 })
          return result
        }

        const p = bot.portfolio
        const result = {
          cash: p.cash,
          totalValue: p.totalValue,
          totalPnlPct: p.totalPnlPct,
          positions: Object.fromEntries(
            Object.entries(p.positions).map(([t, pos]) => [
              t,
              {
                qty: pos.qty,
                avgCost: pos.avgCost,
                currentPrice: pos.currentPrice,
                marketValue: pos.marketValue,
                unrealizedPnlPct: pos.unrealizedPnlPct,
                exposurePct: p.totalValue > 0 ? (pos.marketValue / p.totalValue) * 100 : 0,
              },
            ])
          ),
        }

        ctx.trace.push({ tool: "get_portfolio", args: {}, result, durationMs: Date.now() - t0 })
        return result
      },
    }),

    get_price: tool({
      description:
        "Get the current market price and daily stats for a ticker. " +
        "Use to get a fresh quote before deciding on size.",
      inputSchema: z.object({
        ticker: z.string().describe("Stock ticker symbol, e.g. NVDA"),
      }),
      execute: async ({ ticker }) => {
        const t0 = Date.now()
        const state = ctx.getState()
        const snap = state.snapshots[ticker]

        const result = snap
          ? {
              ticker,
              price: snap.price,
              changePercent: snap.changePercent,
              high: snap.high,
              low: snap.low,
              open: snap.open,
            }
          : { ok: false, error: `No price data for ${ticker}` }

        ctx.trace.push({ tool: "get_price", args: { ticker }, result, durationMs: Date.now() - t0 })
        return result
      },
    }),

    get_analysis: tool({
      description:
        "Get technical analysis for a ticker: RSI14, SMA20, trend direction, and recent price bars. " +
        "Use to inform your decision with momentum and trend context.",
      inputSchema: z.object({
        ticker: z.string().describe("Stock ticker symbol"),
      }),
      execute: async ({ ticker }) => {
        const t0 = Date.now()
        const state = ctx.getState()
        const bars = state.priceHistory[ticker] ?? []
        const recent = bars.slice(-20)

        const rsi14 = computeRSI(recent, 14)
        const sma20 =
          recent.length >= 20
            ? recent.reduce((s, b) => s + b.close, 0) / recent.length
            : null
        const trend = deriveTrend(recent)

        const result = {
          ticker,
          rsi14,
          sma20,
          trend,
          barCount: recent.length,
          recentBars: recent.slice(-5).map((b) => ({
            open: b.open,
            close: b.close,
            volume: b.volume,
          })),
        }

        ctx.trace.push({ tool: "get_analysis", args: { ticker }, result, durationMs: Date.now() - t0 })
        return result
      },
    }),

    place_order: tool({
      description:
        "Record your final trading decision to BUY or SELL. " +
        "Call this exactly once when you have decided. Do not call after hold().",
      inputSchema: z.object({
        ticker: z.string().describe("Stock ticker symbol"),
        action: z.enum(["BUY", "SELL"]).describe("Trade direction"),
        confidence: z.number().min(0).max(1).describe("Conviction level 0–1"),
        reasoning: z.string().describe("One sentence explaining the decision"),
      }),
      execute: async ({ ticker, action, confidence, reasoning }) => {
        const t0 = Date.now()
        const state = ctx.getState()
        const bot = state.bots.find((b) => b.config.type === "ai")

        if (!bot) {
          const result = { ok: false, error: "AI bot not found" }
          ctx.trace.push({ tool: "place_order", args: { ticker, action, confidence, reasoning }, result, durationMs: Date.now() - t0 })
          return result
        }

        // Guardrail check — enforcement in code, not just in prompt
        const violation = checkGuardrails(action, ticker, ctx.price, bot.portfolio)
        if (violation) {
          const result = { ok: false, error: violation }
          ctx.trace.push({ tool: "place_order", args: { ticker, action, confidence, reasoning }, result, durationMs: Date.now() - t0 })
          return result
        }

        const result = { ok: true, action, ticker, confidence, reasoning, price: ctx.price }
        ctx.trace.push({ tool: "place_order", args: { ticker, action, confidence, reasoning }, result, durationMs: Date.now() - t0 })
        return result
      },
    }),

    hold: tool({
      description:
        "Explicitly decide to do nothing this cycle. " +
        "Call this when no trade is warranted. Do not call after place_order().",
      inputSchema: z.object({
        reasoning: z.string().describe("One sentence explaining why you are holding"),
      }),
      execute: async ({ reasoning }) => {
        const t0 = Date.now()
        const result = { ok: true, action: "HOLD", reasoning }
        ctx.trace.push({ tool: "hold", args: { reasoning }, result, durationMs: Date.now() - t0 })
        return result
      },
    }),
  }
}

// ─── RSI (14-period) ──────────────────────────────────────────────────────────

function computeRSI(bars: PriceBar[], period: number): number | null {
  if (bars.length < period + 1) return null

  let gains = 0
  let losses = 0
  for (let i = bars.length - period; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }

  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10
}

// ─── Trend ────────────────────────────────────────────────────────────────────

function deriveTrend(bars: PriceBar[]): "UP" | "DOWN" | "SIDEWAYS" {
  if (bars.length < 5) return "SIDEWAYS"
  const latest = bars[bars.length - 1].close
  const anchor = bars[bars.length - 5].close
  const pct = (latest - anchor) / anchor
  if (pct > 0.005) return "UP"
  if (pct < -0.005) return "DOWN"
  return "SIDEWAYS"
}

// ─── Guardrails ───────────────────────────────────────────────────────────────
// Hard checks — a prompt instruction alone cannot bypass these.

function checkGuardrails(
  action: "BUY" | "SELL",
  ticker: string,
  price: number,
  portfolio: import("@/types").Portfolio
): string | null {
  if (action === "BUY") {
    const minOrderCost = price * 1 // smallest possible order: 1 share
    if (portfolio.cash - minOrderCost < GUARDRAILS.minCashReserve) {
      return `Cash too low: buying 1 share would drop below $${GUARDRAILS.minCashReserve} reserve`
    }

    const existingValue = portfolio.positions[ticker]?.marketValue ?? 0
    const projectedExposure = (existingValue + minOrderCost) / portfolio.totalValue
    if (projectedExposure > MAX_POSITION_PCT) {
      return `Position already at or above ${MAX_POSITION_PCT * 100}% portfolio cap`
    }

    if (portfolio.totalPnlPct / 100 < -GUARDRAILS.maxDailyLossPct) {
      return `Daily loss circuit breaker active: down ${portfolio.totalPnlPct.toFixed(1)}%`
    }
  }

  if (action === "SELL") {
    const position = portfolio.positions[ticker]
    if (!position || position.qty === 0) {
      return `No ${ticker} position to sell`
    }
  }

  return null
}
