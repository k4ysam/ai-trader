"use client"

import type { CommunityAggregate, BotType } from "@/types"

interface StrategyBreakdownProps {
  aggregate: CommunityAggregate
}

const STRATEGY_LABELS: Record<BotType, string> = {
  rsi: "📊 RSI",
  "sma-crossover": "📈 Trend",
  momentum: "🚀 Momentum",
  "mean-reversion": "🔄 Reversal",
  ai: "🤖 AI",
  custom: "⚙️ Custom",
}

export default function StrategyBreakdown({ aggregate }: StrategyBreakdownProps) {
  const { byStrategy } = aggregate

  const entries = (Object.entries(byStrategy) as [BotType, NonNullable<(typeof byStrategy)[BotType]>][])
    .filter(([, slice]) => slice.count > 0)
    .sort(([, a], [, b]) => b.count - a.count)

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 space-y-3">
      {/* Title */}
      <p className="text-xs uppercase tracking-wider text-zinc-400">Strategy Breakdown</p>

      {entries.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-2">No strategy data</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([botType, slice]) => {
            const { count, bullPct } = slice
            const buyW = bullPct
            const remaining = 100 - bullPct
            const holdW = remaining / 2
            const sellW = remaining / 2

            return (
              <div key={botType} className="flex items-center gap-2">
                {/* Strategy label */}
                <span className="w-28 shrink-0 text-xs text-zinc-300 truncate">
                  {STRATEGY_LABELS[botType]}
                </span>

                {/* Count badge */}
                <span className="text-xs text-zinc-600 shrink-0 w-14">
                  {count} bots
                </span>

                {/* Mini segmented bar */}
                <div className="flex-1 h-2 rounded-full overflow-hidden flex">
                  {buyW > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${buyW}%` }}
                    />
                  )}
                  {holdW > 0 && (
                    <div
                      className="h-full bg-zinc-600"
                      style={{ width: `${holdW}%` }}
                    />
                  )}
                  {sellW > 0 && (
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${sellW}%` }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
