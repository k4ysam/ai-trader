"use client"

import type { MarketSnapshot } from "@/types"

interface WatchlistBarProps {
  snapshots: Record<string, MarketSnapshot>
  watchlist: string[]
  selectedTicker: string
  onSelect: (ticker: string) => void
}

export default function WatchlistBar({ snapshots, watchlist, selectedTicker, onSelect }: WatchlistBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {watchlist.map((ticker) => {
        const snap = snapshots[ticker]
        const isSelected = ticker === selectedTicker
        const isUp = (snap?.changePercent ?? 0) >= 0

        return (
          <button
            key={ticker}
            onClick={() => onSelect(ticker)}
            className={`flex shrink-0 flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-all ${
              isSelected
                ? "border-zinc-600 bg-zinc-800/80 shadow-lg"
                : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/60"
            }`}
          >
            <span className="text-xs font-bold text-white">{ticker}</span>
            {snap ? (
              <>
                <span className="mt-0.5 text-sm font-semibold text-white">
                  ${snap.price.toFixed(2)}
                </span>
                <span className={`text-xs font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {isUp ? "▲" : "▼"} {Math.abs(snap.changePercent).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="mt-0.5 text-xs text-zinc-600">—</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
