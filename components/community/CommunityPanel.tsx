"use client"

import { useEffect, useRef, useState } from "react"
import type { BotState, CommunityState, Ticker } from "@/types"
import SentimentGauge from "./SentimentGauge"
import StrategyBreakdown from "./StrategyBreakdown"
import CommunityTradeFeed from "./CommunityTradeFeed"
import PnLDistribution from "./PnLDistribution"
import CommunityTimeline from "./CommunityTimeline"
import CommunityComparison from "./CommunityComparison"
import ConvictionHeatmap from "./ConvictionHeatmap"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommunityPanelProps {
  selectedTicker: Ticker
  userBots: BotState[]
}

type Tab = "sentiment" | "strategies" | "pnl" | "feed" | "history" | "compare" | "heatmap"

const TABS: { id: Tab; label: string }[] = [
  { id: "sentiment", label: "Sentiment" },
  { id: "strategies", label: "Strategies" },
  { id: "pnl", label: "P&L" },
  { id: "feed", label: "Live Feed" },
  { id: "history", label: "History" },
  { id: "compare", label: "Compare" },
  { id: "heatmap", label: "Heatmap" },
]

// ─── CommunityPanel ───────────────────────────────────────────────────────────

export default function CommunityPanel({ selectedTicker, userBots }: CommunityPanelProps) {
  const [communityState, setCommunityState] = useState<CommunityState | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("sentiment")
  const [sseError, setSseError] = useState(false)

  // ─── SSE connection ─────────────────────────────────────────────────────────

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource("/api/community/stream")

      es.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data) as CommunityState
          setCommunityState(state)
          setSseError(false)
        } catch {
          // Ignore malformed frames
        }
      }

      es.onerror = () => {
        es?.close()
        setSseError(true)
        retryTimer = setTimeout(connect, 4_000)
      }
    }

    connect()

    return () => {
      es?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const aggregate = communityState?.aggregates[selectedTicker]
  const allTrades = Object.values(communityState?.aggregates ?? {}).flatMap(
    (agg) => (agg ? agg.recentTrades : [])
  )
  const sortedTrades = [...allTrades].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  const isLoading = !communityState

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Community Intelligence
          </h2>
          {/* Simulated data badge — shown when community is not live */}
          {process.env.NEXT_PUBLIC_COMMUNITY_ENABLED !== "true" && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              SIMULATED DATA
            </span>
          )}
          {process.env.NEXT_PUBLIC_COMMUNITY_ENABLED === "true" && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Community stats */}
        {communityState && (
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {communityState.totalActiveSessions.toLocaleString()}
              </span>{" "}
              sessions
            </span>
            <span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {communityState.totalActiveBots.toLocaleString()}
              </span>{" "}
              bots
            </span>
            {sseError && (
              <span className="text-yellow-400">reconnecting…</span>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-800/60 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-violet-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {activeTab === "sentiment" && aggregate && (
              <SentimentGauge aggregate={aggregate} />
            )}
            {activeTab === "sentiment" && !aggregate && (
              <EmptyState message="No data for this ticker yet." />
            )}

            {activeTab === "strategies" && aggregate && (
              <StrategyBreakdown aggregate={aggregate} />
            )}
            {activeTab === "strategies" && !aggregate && (
              <EmptyState message="No strategy data yet." />
            )}

            {activeTab === "pnl" && aggregate && (
              <PnLDistribution aggregate={aggregate} userBots={userBots} />
            )}
            {activeTab === "pnl" && !aggregate && (
              <EmptyState message="No P&L data yet." />
            )}

            {activeTab === "feed" && (
              <CommunityTradeFeed trades={sortedTrades} />
            )}

            {activeTab === "history" && (
              <CommunityTimeline ticker={selectedTicker} />
            )}

            {activeTab === "compare" && aggregate && (
              <CommunityComparison aggregate={aggregate} userBots={userBots} />
            )}
            {activeTab === "compare" && !aggregate && (
              <EmptyState message="No community data to compare against yet." />
            )}

            {activeTab === "heatmap" && communityState && (
              <ConvictionHeatmap communityState={communityState} />
            )}
            {activeTab === "heatmap" && !communityState && (
              <EmptyState message="No data yet." />
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 rounded-lg bg-zinc-800/60 w-3/4" />
      <div className="h-4 rounded bg-zinc-800/60 w-full" />
      <div className="h-4 rounded bg-zinc-800/60 w-5/6" />
      <div className="h-4 rounded bg-zinc-800/60 w-2/3" />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-24 text-xs text-zinc-600">
      {message}
    </div>
  )
}
