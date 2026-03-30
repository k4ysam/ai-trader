"use client"

import type { CommunityAggregate, BotState, BotType } from "@/types"

interface CommunityComparisonProps {
  aggregate: CommunityAggregate
  userBots: BotState[]
}

const STRATEGY_LABELS: Record<BotType, string> = {
  rsi: "📊 RSI",
  "sma-crossover": "📈 Trend",
  momentum: "🚀 Momentum",
  "mean-reversion": "🔄 Reversal",
  ai: "🤖 AI",
  custom: "⚙️ Custom",
}

function computePercentileRank(
  pnl: number,
  percentiles: { p25: number; p50: number; p75: number; p90: number }
): { label: string; variant: "default" | "violet" | "green" } {
  const { p25, p50, p75, p90 } = percentiles
  if (pnl >= p90) return { label: "Top 10%", variant: "green" }
  if (pnl >= p75) return { label: "Top 10%", variant: "green" }
  if (pnl >= p50) return { label: "Top 25%", variant: "violet" }
  if (pnl >= p25) return { label: "Top 50%", variant: "default" }
  return { label: "Bottom 25%", variant: "default" }
}

function computeWeightedAvgConfidence(buckets: number[]): number {
  const total = buckets.reduce((sum, v) => sum + v, 0)
  if (total === 0) return 0
  const weighted = buckets.reduce((sum, v, i) => sum + v * (i * 0.1 + 0.05), 0)
  return (weighted / total) * 100
}

export default function CommunityComparison({ aggregate, userBots }: CommunityComparisonProps) {
  const hasAnyTrades = userBots.some((b) => b.portfolio.tradeHistory.length > 0)

  if (aggregate.totalBots === 0 || !hasAnyTrades) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-6 text-center">
        <p className="text-xs text-zinc-500">
          Start the simulation to compare with the community.
        </p>
      </div>
    )
  }

  // ── Section 1: P&L Rank ──────────────────────────────────────────────────
  const pnlSection = userBots.map((bot) => {
    const pnl = bot.portfolio.totalPnlPct
    const { label, variant } = computePercentileRank(pnl, aggregate.pnlPercentiles)
    const badgeClass =
      variant === "green"
        ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
        : variant === "violet"
        ? "bg-violet-600/30 text-violet-400 border border-violet-500/30"
        : "bg-zinc-700 text-zinc-400"
    const pnlPositive = pnl >= 0
    return { bot, pnl, label, badgeClass, pnlPositive }
  })

  // ── Section 2: Strategy Alignment ────────────────────────────────────────
  const uniqueTypes = Array.from(new Set(userBots.map((b) => b.config.type)))
  const strategyRows = uniqueTypes
    .filter((type) => aggregate.byStrategy[type] !== undefined)
    .map((type) => {
      const slice = aggregate.byStrategy[type]!
      const botsOfType = userBots.filter((b) => b.config.type === type)
      // Pick the first bot with a last decision, or fall back to first bot
      const representativeBot =
        botsOfType.find((b) => b.lastDecision !== null) ?? botsOfType[0]
      const action = representativeBot.lastDecision?.action ?? "HOLD"
      const majorityBullish = slice.bullPct >= 50
      const aligned =
        (action === "BUY" && majorityBullish) ||
        (action === "SELL" && !majorityBullish) ||
        action === "HOLD"
      return { type, slice, action, aligned, botName: representativeBot.config.name }
    })

  // ── Section 3: Aggression Score ──────────────────────────────────────────
  const communityAvgConfidence = computeWeightedAvgConfidence(aggregate.convictionBuckets)
  const botsWithDecisions = userBots.filter((b) => b.lastDecision !== null)
  const userAvgConfidence =
    botsWithDecisions.length > 0
      ? (botsWithDecisions.reduce((sum, b) => sum + (b.lastDecision!.confidence * 100), 0) /
          botsWithDecisions.length)
      : 0

  const diff = userAvgConfidence - communityAvgConfidence
  const aggressionLabel =
    diff > 15
      ? "More aggressive than community"
      : diff < -15
      ? "More conservative than community"
      : "Aligned with community"

  const userBarWidth = Math.min(100, Math.round(userAvgConfidence))
  const commBarWidth = Math.min(100, Math.round(communityAvgConfidence))

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 divide-y divide-zinc-800">
      {/* ── Section 1: P&L Rank ─────────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-zinc-400">
          Your portfolio vs. community
        </p>
        <div className="space-y-2">
          {pnlSection.map(({ bot, pnl, label, badgeClass, pnlPositive }) => (
            <div key={bot.config.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">{bot.config.emoji}</span>
                <span className="text-xs text-zinc-300 truncate">{bot.config.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${pnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {pnlPositive ? "+" : ""}
                  {pnl.toFixed(1)}%
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Strategy Alignment ───────────────────────────────── */}
      {strategyRows.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-400">
            Your strategy vs. community
          </p>
          <div className="space-y-2">
            {strategyRows.map(({ type, slice, action, aligned }) => {
              const actionColor =
                action === "BUY"
                  ? "text-emerald-400"
                  : action === "SELL"
                  ? "text-rose-400"
                  : "text-zinc-400"
              return (
                <div key={type} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-300">
                      {STRATEGY_LABELS[type]}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Community: {Math.round(slice.bullPct)}% bullish
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium ${actionColor}`}>
                      Your action: {action}
                    </span>
                    <span
                      className={`text-xs ${
                        aligned ? "text-zinc-500" : "text-amber-400"
                      }`}
                    >
                      {aligned ? "✓ With the crowd" : "↗ Contrarian"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section 3: Aggression Score ─────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-zinc-400">
          Trading aggression
        </p>
        <div className="space-y-1.5">
          {/* You bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-14 shrink-0">You</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full"
                style={{ width: `${userBarWidth}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 w-8 text-right shrink-0">
              {Math.round(userAvgConfidence)}%
            </span>
          </div>
          {/* Community bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-14 shrink-0">Community</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-500 rounded-full"
                style={{ width: `${commBarWidth}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 w-8 text-right shrink-0">
              {Math.round(communityAvgConfidence)}%
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-500">{aggressionLabel}</p>
      </div>
    </div>
  )
}
