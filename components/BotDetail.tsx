"use client"

import { useEffect, useState } from "react"
import type { AgentToolCall, AriaCycle, BotState } from "@/types"

interface BotDetailProps {
  bot: BotState
  ariaLastRunAt?: number | null
  ariaCadenceMs?: number
  ariaLastCycle?: AriaCycle | null
}

function formatCountdown(ariaLastRunAt: number | null | undefined, cadence: number): string {
  if (!ariaLastRunAt) return "Ready"
  const remaining = ariaLastRunAt + cadence - Date.now()
  if (remaining <= 0) return "Deciding…"
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1_000)
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function useAriaCountdown(ariaLastRunAt: number | null | undefined, ariaCadenceMs: number | undefined): string {
  const [label, setLabel] = useState("")

  useEffect(() => {
    if (!ariaCadenceMs) return
    const cadence = ariaCadenceMs
    setLabel(formatCountdown(ariaLastRunAt, cadence))
    const id = setInterval(() => setLabel(formatCountdown(ariaLastRunAt, cadence)), 1_000)
    return () => clearInterval(id)
  }, [ariaLastRunAt, ariaCadenceMs])

  return label
}

function TraceRow({ call }: { call: AgentToolCall }) {
  const result = call.result
  let resultStr: string
  if (typeof result === "string") {
    resultStr = result
  } else if (result === null || result === undefined) {
    resultStr = "—"
  } else {
    resultStr = JSON.stringify(result)
  }
  // Truncate long results for display
  const display = resultStr.length > 120 ? resultStr.slice(0, 120) + "…" : resultStr

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-zinc-800/40 last:border-0">
      <span className="shrink-0 font-mono text-[10px] text-violet-400 bg-violet-500/10 rounded px-1.5 py-0.5 mt-0.5">
        {call.tool}
      </span>
      <span className="text-[10px] text-zinc-400 break-all leading-relaxed">{display}</span>
      <span className="ml-auto shrink-0 text-[9px] text-zinc-600">{call.durationMs}ms</span>
    </div>
  )
}

export default function BotDetail({ bot, ariaLastRunAt, ariaCadenceMs, ariaLastCycle }: BotDetailProps) {
  const { portfolio, config } = bot
  const positions = Object.values(portfolio.positions)
  const history = [...portfolio.tradeHistory].reverse().slice(0, 15)
  const isAI = config.type === "ai"
  const countdown = useAriaCountdown(ariaLastRunAt, ariaCadenceMs)
  const [traceOpen, setTraceOpen] = useState(false)

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-zinc-800/60 flex items-center gap-3 ${isAI ? "border-l-2 border-violet-500" : ""}`}>
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{config.name}</span>
            {isAI && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-violet-500/20 text-violet-400">AI TRADER</span>
            )}
          </div>
          <span className="text-xs text-zinc-500">{config.type}</span>
        </div>
        {isAI && countdown && (
          <div className="ml-3 flex items-center gap-1.5 rounded-md bg-zinc-800/60 px-2 py-1">
            <span className="text-[10px] text-zinc-500">Next decision</span>
            <span className="font-mono text-[11px] font-semibold text-violet-400">{countdown}</span>
          </div>
        )}
        <div className="ml-auto text-right">
          <div className={`text-lg font-bold ${portfolio.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {portfolio.totalPnl >= 0 ? "+" : ""}{portfolio.totalPnlPct.toFixed(2)}%
          </div>
          <div className="text-xs text-zinc-500">
            ${portfolio.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-3 divide-x divide-zinc-800/60 border-b border-zinc-800/60">
        {[
          { label: "Cash", value: `$${portfolio.cash.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
          { label: "P&L", value: `${portfolio.totalPnl >= 0 ? "+" : ""}$${Math.abs(portfolio.totalPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
          { label: "Trades", value: portfolio.tradeHistory.length },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-sm font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* ARIA Last Cycle */}
      {isAI && (
        <div className="border-b border-zinc-800/60">
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Last ARIA Cycle</div>
          {ariaLastCycle ? (
            <div className="px-4 pb-3 space-y-2">
              {/* Action + reasoning */}
              <div className="flex items-start gap-2">
                <span className={`shrink-0 mt-0.5 rounded px-2 py-0.5 text-[10px] font-bold ${
                  ariaLastCycle.action === "BUY"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : ariaLastCycle.action === "SELL"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-700/60 text-zinc-400"
                }`}>
                  {ariaLastCycle.action}
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">{ariaLastCycle.reasoning}</p>
              </div>
              {/* Ticker + timestamp */}
              <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                <span>{ariaLastCycle.ticker}</span>
                <span>·</span>
                <span>{new Date(ariaLastCycle.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
              {/* Collapsible tool trace */}
              {ariaLastCycle.trace.length > 0 && (
                <div>
                  <button
                    onClick={() => setTraceOpen((o) => !o)}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <span>{traceOpen ? "▾" : "▸"}</span>
                    <span>Tool trace ({ariaLastCycle.trace.length} steps)</span>
                  </button>
                  {traceOpen && (
                    <div className="mt-2 rounded-md bg-zinc-950/60 border border-zinc-800/40 px-3 py-1">
                      {ariaLastCycle.trace.map((call, i) => (
                        <TraceRow key={i} call={call} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 pb-3 text-xs text-zinc-600">No cycle yet — ARIA fires in {countdown || "…"}</div>
          )}
        </div>
      )}

      {/* Positions */}
      {positions.length > 0 && (
        <div className="border-b border-zinc-800/60">
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Positions</div>
          <div className="divide-y divide-zinc-800/40">
            {positions.map((pos) => (
              <div key={pos.ticker} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm font-bold text-white w-12">{pos.ticker}</span>
                <span className="text-xs text-zinc-500">{pos.qty} shares @ ${pos.avgCost.toFixed(2)}</span>
                <div className="ml-auto text-right">
                  <div className="text-xs font-medium text-white">${pos.marketValue.toFixed(0)}</div>
                  <div className={`text-xs ${pos.unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {pos.unrealizedPnl >= 0 ? "+" : ""}{pos.unrealizedPnlPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade history */}
      {history.length > 0 && (
        <div>
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Recent Trades</div>
          <div className="divide-y divide-zinc-800/40 max-h-48 overflow-y-auto">
            {history.map((order, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    order.action === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {order.action}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white">
                    {order.qty} {order.ticker} @ ${order.price.toFixed(2)}
                  </span>
                  {order.reasoning && (
                    <p className="mt-0.5 text-[10px] text-zinc-500 truncate">{order.reasoning}</p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {positions.length === 0 && history.length === 0 && (
        <div className="px-4 py-8 text-center text-xs text-zinc-600">No activity yet</div>
      )}
    </div>
  )
}
