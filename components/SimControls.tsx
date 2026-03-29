"use client"

import type { SimStatus } from "@/types"

interface SimControlsProps {
  status: SimStatus
  tickCount: number
  startedAt: number | null
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}

const STATUS_COLORS: Record<SimStatus, string> = {
  idle: "bg-zinc-500",
  running: "bg-emerald-500",
  paused: "bg-yellow-500",
}

const STATUS_LABELS: Record<SimStatus, string> = {
  idle: "Idle",
  running: "Live",
  paused: "Paused",
}

export default function SimControls({
  status,
  tickCount,
  startedAt,
  onStart,
  onPause,
  onResume,
  onReset,
}: SimControlsProps) {
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
  const elapsedStr =
    elapsed >= 3600
      ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
      : elapsed >= 60
      ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
      : `${elapsed}s`

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Status pill */}
      <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1">
        <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]} ${status === "running" ? "animate-pulse" : ""}`} />
        <span className="text-xs font-medium text-zinc-300">{STATUS_LABELS[status]}</span>
      </div>

      {/* Controls */}
      {status === "idle" && (
        <button
          onClick={onStart}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          ▶ Start
        </button>
      )}
      {status === "running" && (
        <button
          onClick={onPause}
          className="rounded-lg bg-yellow-600 hover:bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          ⏸ Pause
        </button>
      )}
      {status === "paused" && (
        <button
          onClick={onResume}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          ▶ Resume
        </button>
      )}
      <button
        onClick={onReset}
        className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors"
      >
        ↺ Reset
      </button>

      {/* Stats */}
      {status !== "idle" && (
        <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
          <span>{tickCount.toLocaleString()} ticks</span>
          {startedAt && <span>{elapsedStr}</span>}
        </div>
      )}
    </div>
  )
}
