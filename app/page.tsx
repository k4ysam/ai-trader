"use client"

import { useEffect, useState, useCallback } from "react"
import type { SimState, BotType, SimMode, ReplaySpeed } from "@/types"
import SimControls from "@/components/SimControls"
import WatchlistBar from "@/components/WatchlistBar"
import BotLeaderboard from "@/components/BotLeaderboard"
import BotDetail from "@/components/BotDetail"
import TradeFeed from "@/components/TradeFeed"
import PriceChart from "@/components/PriceChart"
import BotImporter from "@/components/BotImporter"
import CommunityPanel from "@/components/community/CommunityPanel"
import { useHeartbeat } from "@/lib/community/use-heartbeat"

export default function Home() {
  const [simState, setSimState] = useState<SimState | null>(null)
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string>("NVDA")
  const [showImporter, setShowImporter] = useState(false)
  const [sseError, setSseError] = useState(false)
  const [mode, setMode] = useState<SimMode>("live")
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1)

  // ─── SSE connection ───────────────────────────────────────────────────────

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource("/api/market/stream")

      es.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data) as SimState
          setSimState(state)
          setSseError(false)
        } catch {
          // Ignore malformed frames
        }
      }

      es.onerror = () => {
        es?.close()
        setSseError(true)
        retryTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      es?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  // ─── Sim controls ─────────────────────────────────────────────────────────

  const post = useCallback((path: string, body?: unknown) => {
    fetch(path, {
      method: "POST",
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    }).catch(() => null)
  }, [])

  const handleSpeedChange = useCallback(
    (speed: ReplaySpeed) => {
      setReplaySpeed(speed)
      post("/api/sim/replay-speed", { speed })
    },
    [post],
  )

  // ─── Bot import ───────────────────────────────────────────────────────────

  async function handleImportBot(payload: {
    name: string
    type: BotType
    params: Record<string, number>
    emoji: string
    color: string
  }) {
    setShowImporter(false)
    await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  }

  // ─── Community heartbeat (publishes local bot state when enabled) ─────────
  useHeartbeat(simState)

  // ─── Derived ──────────────────────────────────────────────────────────────

  const selectedBot = simState?.bots.find((b) => b.config.id === selectedBotId) ?? null
  const chartBars = simState?.priceHistory[selectedTicker] ?? []

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-white dot-grid-bg">
      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[radial-gradient(ellipse_at_center,#8b5cf620,transparent_70%)] blur-[80px]" />
        <div className="absolute top-1/2 -left-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,#10b98115,transparent_70%)] blur-[80px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-2 flex w-fit items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/80 px-2 py-1">
              <span className="rounded-sm border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-400">PAPER</span>
              <span className="text-xs text-zinc-400">AI vs. Rule-Based Trading Simulation</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Paper Trader
            </h1>
          </div>

          {/* Add bot button */}
          <button
            onClick={() => setShowImporter(true)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700/80 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors"
          >
            + Add Bot
          </button>
        </div>

        {/* SSE reconnecting banner */}
        {sseError && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-400">
            Connection lost — reconnecting…
          </div>
        )}

        {/* Sim controls */}
        {simState && (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
            <SimControls
              status={simState.status}
              tickCount={simState.tickCount}
              startedAt={simState.startedAt}
              onStart={() => post("/api/sim/start", { mode, speed: replaySpeed })}
              onPause={() => post("/api/sim/pause")}
              onResume={() => post("/api/sim/resume")}
              onReset={() => post("/api/sim/reset")}
              mode={mode}
              onModeChange={setMode}
              replaySpeed={replaySpeed}
              onSpeedChange={handleSpeedChange}
              replay={simState.replay}
            />
          </div>
        )}

        {/* Watchlist ticker bar */}
        {simState && (
          <WatchlistBar
            snapshots={simState.snapshots}
            watchlist={simState.watchlist}
            selectedTicker={selectedTicker}
            onSelect={setSelectedTicker}
          />
        )}

        {/* Loading skeleton */}
        {!simState && (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-zinc-500 animate-pulse">Connecting to simulation…</div>
          </div>
        )}

        {/* Main content grid */}
        {simState && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* Left: Leaderboard */}
            <div className="lg:col-span-1 space-y-4">
              <BotLeaderboard
                bots={simState.bots}
                selectedBotId={selectedBotId}
                onSelect={(id) => setSelectedBotId(id === selectedBotId ? null : id)}
              />
            </div>

            {/* Right: Chart + detail/feed */}
            <div className="lg:col-span-2 space-y-4">
              <PriceChart ticker={selectedTicker} bars={chartBars} />

              {selectedBot ? (
                <BotDetail bot={selectedBot} />
              ) : (
                <TradeFeed bots={simState.bots} />
              )}
            </div>
          </div>
        )}

        {/* Community Intelligence panel */}
        {simState && (
          <CommunityPanel
            selectedTicker={selectedTicker}
            userBots={simState.bots}
          />
        )}
      </div>

      {/* Bot importer modal */}
      {showImporter && (
        <BotImporter
          onImport={handleImportBot}
          onClose={() => setShowImporter(false)}
        />
      )}
    </main>
  )
}
