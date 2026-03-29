"use client"

import type { BotState } from "@/types"

interface BotLeaderboardProps {
  bots: BotState[]
  selectedBotId: string | null
  onSelect: (botId: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  ai: "AI",
  rsi: "RSI",
  "sma-crossover": "SMA",
  momentum: "MOM",
  "mean-reversion": "REV",
  custom: "CUSTOM",
}

export default function BotLeaderboard({ bots, selectedBotId, onSelect }: BotLeaderboardProps) {
  const sorted = [...bots].sort((a, b) => b.portfolio.totalValue - a.portfolio.totalValue)

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Bot Leaderboard</p>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {sorted.map((bot, i) => {
          const pnl = bot.portfolio.totalPnl
          const pnlPct = bot.portfolio.totalPnlPct
          const isUp = pnl >= 0
          const isAI = bot.config.type === "ai"
          const isSelected = bot.config.id === selectedBotId

          return (
            <button
              key={bot.config.id}
              onClick={() => onSelect(bot.config.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"
              } ${isAI ? "border-l-2 border-violet-500" : ""}`}
            >
              {/* Rank */}
              <span className="w-5 text-center text-xs font-bold text-zinc-500">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
              </span>

              {/* Emoji + name */}
              <span className="text-lg leading-none">{bot.config.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{bot.config.name}</span>
                  <span
                    className="rounded px-1 py-0.5 text-[10px] font-bold uppercase"
                    style={{ backgroundColor: bot.config.color + "33", color: bot.config.color }}
                  >
                    {TYPE_LABELS[bot.config.type] ?? bot.config.type}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  ${bot.portfolio.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* P&L */}
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {isUp ? "+" : ""}{pnlPct.toFixed(2)}%
                </div>
                <div className={`text-xs ${isUp ? "text-emerald-600" : "text-red-600"}`}>
                  {isUp ? "+" : ""}${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
