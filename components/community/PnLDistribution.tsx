"use client"

import type { CommunityAggregate, BotState } from "@/types"

interface PnLDistributionProps {
  aggregate: CommunityAggregate
  userBots: BotState[]
}

interface PercentileBar {
  label: string
  value: number
  heightPct: number
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function getPnlColor(value: number): string {
  return value >= 0 ? "text-emerald-400" : "text-rose-400"
}

function getBarColor(value: number): string {
  return value >= 0 ? "bg-emerald-500" : "bg-rose-500"
}

/**
 * Normalise an array of values so the tallest bar fills 100% height.
 * Returns heights as percentages (0–100).
 */
function normaliseHeights(values: number[]): number[] {
  const absValues = values.map(Math.abs)
  const max = Math.max(...absValues, 0.01) // avoid div-by-zero
  return absValues.map((v) => Math.max((v / max) * 100, 4)) // min 4% so bar is visible
}

export default function PnLDistribution({ aggregate, userBots }: PnLDistributionProps) {
  if (aggregate.totalBots === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            P&L Distribution
          </span>
        </div>
        <div className="flex items-end gap-2 h-16">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-zinc-800 animate-pulse"
              style={{ height: `${(i + 1) * 20}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-600 text-center">No community data yet</p>
      </div>
    )
  }

  const { p25, p50, p75, p90 } = aggregate.pnlPercentiles

  const bars: PercentileBar[] = [
    { label: "P25", value: p25, heightPct: 0 },
    { label: "P50", value: p50, heightPct: 0 },
    { label: "P75", value: p75, heightPct: 0 },
    { label: "P90", value: p90, heightPct: 0 },
  ]

  const heights = normaliseHeights([p25, p50, p75, p90])
  const enrichedBars: PercentileBar[] = bars.map((bar, i) => ({
    ...bar,
    heightPct: heights[i],
  }))

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          P&L Distribution
        </span>
        <span className="text-xs text-zinc-400">
          Community median:{" "}
          <span className={getPnlColor(p50)}>{formatPnl(p50)}</span>
        </span>
      </div>

      {/* Histogram bars */}
      <div className="flex items-end gap-2 h-16">
        {enrichedBars.map((bar) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: "52px" }}>
              <div
                className={`w-full rounded-t transition-all ${getBarColor(bar.value)}`}
                style={{ height: `${bar.heightPct}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-600">{bar.label}</span>
            <span className={`text-[10px] font-mono ${getPnlColor(bar.value)}`}>
              {formatPnl(bar.value)}
            </span>
          </div>
        ))}
      </div>

      {/* User bots section */}
      {userBots.length > 0 && (
        <div className="border-t border-zinc-800/60 pt-2 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Your bots
          </span>
          {userBots.map((bot) => {
            const pnl = bot.portfolio.totalPnlPct
            return (
              <div
                key={bot.config.id}
                className="flex items-center justify-between"
              >
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <span>{bot.config.emoji}</span>
                  <span className="truncate max-w-[120px]">{bot.config.name}</span>
                </span>
                <span className={`text-xs font-mono ${getPnlColor(pnl)}`}>
                  {formatPnl(pnl)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
