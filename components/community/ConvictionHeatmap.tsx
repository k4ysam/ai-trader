"use client"

import type { CommunityState, BotType, Ticker } from "@/types"

interface ConvictionHeatmapProps {
  communityState: CommunityState
}

const STRATEGY_ORDER: BotType[] = [
  "rsi",
  "sma-crossover",
  "momentum",
  "mean-reversion",
  "ai",
  "custom",
]

const STRATEGY_EMOJI: Record<BotType, string> = {
  rsi: "📊",
  "sma-crossover": "📈",
  momentum: "🚀",
  "mean-reversion": "🔄",
  ai: "🤖",
  custom: "⚙️",
}

function bullPctCellClass(bullPct: number | undefined): string {
  if (bullPct === undefined) return "bg-zinc-800/50"
  if (bullPct > 65) return "bg-emerald-500/70"
  if (bullPct >= 50) return "bg-emerald-500/30"
  if (bullPct >= 35) return "bg-zinc-700"
  if (bullPct >= 20) return "bg-rose-500/30"
  return "bg-rose-500/70"
}

const LEGEND_ITEMS: Array<{ className: string; label: string }> = [
  { className: "bg-emerald-500/70", label: "Strong Buy" },
  { className: "bg-emerald-500/30", label: "Buy" },
  { className: "bg-zinc-700", label: "Neutral" },
  { className: "bg-rose-500/30", label: "Sell" },
  { className: "bg-rose-500/70", label: "Strong Sell" },
]

export default function ConvictionHeatmap({ communityState }: ConvictionHeatmapProps) {
  const { aggregates } = communityState

  const tickers: Ticker[] = Object.keys(aggregates).sort()

  const hasData = tickers.length > 0

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 space-y-3">
      {/* Title */}
      <p className="text-xs uppercase tracking-wider text-zinc-400">
        Conviction Heatmap
      </p>

      {!hasData ? (
        <p className="text-xs text-zinc-500 text-center py-2">No data yet</p>
      ) : (
        <>
          {/* Grid */}
          <div className="overflow-x-auto">
            <div
              className="grid gap-1 min-w-max"
              style={{
                gridTemplateColumns: `3rem repeat(${STRATEGY_ORDER.length}, 2.5rem)`,
              }}
            >
              {/* Corner + column headers */}
              <div /> {/* empty corner */}
              {STRATEGY_ORDER.map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-center text-xs text-zinc-500 h-6"
                  title={type}
                >
                  {STRATEGY_EMOJI[type]}
                </div>
              ))}

              {/* Data rows */}
              {tickers.map((ticker) => {
                const agg = aggregates[ticker]
                return (
                  <>
                    {/* Row header */}
                    <div
                      key={`${ticker}-label`}
                      className="flex items-center text-xs text-zinc-400 w-12 h-8"
                    >
                      {ticker}
                    </div>

                    {/* Cells */}
                    {STRATEGY_ORDER.map((type) => {
                      const slice = agg?.byStrategy[type]
                      const bullPct = slice?.bullPct
                      const count = slice?.count
                      const cellClass = bullPctCellClass(bullPct)
                      const tooltipText =
                        bullPct !== undefined
                          ? `${ticker} ${type}: ${Math.round(bullPct)}% bullish, ${count ?? 0} bots`
                          : `${ticker} ${type}: no data`
                      return (
                        <div
                          key={`${ticker}-${type}`}
                          className={`w-10 h-8 rounded flex items-center justify-center ${cellClass}`}
                          title={tooltipText}
                        >
                          {bullPct !== undefined && (
                            <span className="text-xs text-white/70">
                              {Math.round(bullPct)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {LEGEND_ITEMS.map(({ className, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-sm ${className}`} />
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
