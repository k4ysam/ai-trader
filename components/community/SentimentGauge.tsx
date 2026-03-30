"use client"

import type { CommunityAggregate } from "@/types"

interface SentimentGaugeProps {
  aggregate: CommunityAggregate
}

function clampSegment(pct: number): number {
  if (pct <= 0) return 0
  if (pct < 3) return 3
  return pct
}

export default function SentimentGauge({ aggregate }: SentimentGaugeProps) {
  const { ticker, totalBots, bullPct, bearPct, holdPct } = aggregate

  if (totalBots === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white text-sm">{ticker}</span>
          <span className="text-xs text-zinc-400">0 bots</span>
        </div>
        <div className="h-3 w-full rounded-full bg-zinc-700 animate-pulse" />
        <p className="text-xs text-zinc-500 text-center">No data yet</p>
      </div>
    )
  }

  const rawBuy = clampSegment(bullPct)
  const rawHold = clampSegment(holdPct)
  const rawSell = clampSegment(bearPct)

  // Normalise so the three segments sum to exactly 100%
  const total = rawBuy + rawHold + rawSell
  const buyW = (rawBuy / total) * 100
  const holdW = (rawHold / total) * 100
  const sellW = (rawSell / total) * 100

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-white text-sm">{ticker}</span>
        <span className="text-xs text-zinc-400">{totalBots} bots</span>
      </div>

      {/* Segmented bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex">
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

      {/* Legend */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-emerald-400">
          ▲ BUY {Math.round(bullPct)}%
        </span>
        <span className="text-xs text-zinc-400">
          ● HOLD {Math.round(holdPct)}%
        </span>
        <span className="text-xs text-rose-400">
          ▼ SELL {Math.round(bearPct)}%
        </span>
      </div>
    </div>
  )
}
