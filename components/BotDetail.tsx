"use client"

import type { BotState } from "@/types"

interface BotDetailProps {
  bot: BotState
}

export default function BotDetail({ bot }: BotDetailProps) {
  const { portfolio, config } = bot
  const positions = Object.values(portfolio.positions)
  const history = [...portfolio.tradeHistory].reverse().slice(0, 15)
  const isAI = config.type === "ai"

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
