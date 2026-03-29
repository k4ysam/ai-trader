"use client"

import { useEffect, useRef } from "react"
import type { AnonymousTrade, BotType } from "@/types"

interface CommunityTradeFeedProps {
  trades: AnonymousTrade[]
}

const STRATEGY_EMOJI: Record<BotType, string> = {
  rsi: "📊",
  "sma-crossover": "📈",
  momentum: "🚀",
  "mean-reversion": "🔄",
  ai: "🤖",
  custom: "⚙️",
}

function getStrategyEmoji(botType: BotType): string {
  return STRATEGY_EMOJI[botType] ?? "🤖"
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  return `${diffHour}h ago`
}

function getConvictionColor(confidence: number): string {
  if (confidence > 0.7) return "bg-emerald-400"
  if (confidence >= 0.4) return "bg-yellow-400"
  return "bg-zinc-500"
}

export default function CommunityTradeFeed({ trades }: CommunityTradeFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [trades])

  return (
    <div
      ref={scrollRef}
      className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700"
    >
      {trades.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-zinc-600">
          Waiting for community trades…
        </div>
      ) : (
        trades.map((trade, i) => (
          <div
            key={`${trade.botType}-${trade.ticker}-${trade.timestamp}-${i}`}
            className="flex items-center gap-2 py-1.5 px-3 hover:bg-zinc-800/50 transition-colors"
          >
            {/* Strategy emoji + action badge */}
            <span className="text-sm leading-none shrink-0">
              {getStrategyEmoji(trade.botType)}
            </span>
            <span
              className={`shrink-0 rounded px-1.5 text-xs font-mono border ${
                trade.action === "BUY"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
              }`}
            >
              {trade.action}
            </span>

            {/* Ticker */}
            <span className="flex-1 text-white font-mono text-sm">{trade.ticker}</span>

            {/* Conviction dot */}
            <span
              className={`shrink-0 h-1.5 w-1.5 rounded-full ${getConvictionColor(trade.confidence)}`}
            />

            {/* Time ago */}
            <span className="shrink-0 text-xs text-zinc-500">{timeAgo(trade.timestamp)}</span>
          </div>
        ))
      )}
    </div>
  )
}
