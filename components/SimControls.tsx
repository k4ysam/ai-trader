"use client"

import type { SimStatus, SimMode, ReplaySpeed, ReplayState } from "@/types"

interface SimControlsProps {
  status: SimStatus
  tickCount: number
  startedAt: number | null
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  mode: SimMode
  onModeChange: (mode: SimMode) => void
  replaySpeed: ReplaySpeed
  onSpeedChange: (speed: ReplaySpeed) => void
  replay: ReplayState
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

const REPLAY_SPEEDS: ReplaySpeed[] = [1, 5, 10, 50]

function formatReplayTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SimControls({
  status,
  tickCount,
  startedAt,
  onStart,
  onPause,
  onResume,
  onReset,
  mode,
  onModeChange,
  replaySpeed,
  onSpeedChange,
  replay,
}: SimControlsProps) {
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
  const elapsedStr =
    elapsed >= 3600
      ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
      : elapsed >= 60
      ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
      : `${elapsed}s`

  const isReplayActive = mode === "replay" && (status === "running" || status === "paused")
  const showReplayProgress = mode === "replay" && replay.totalBars > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status pill */}
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]} ${status === "running" ? "animate-pulse" : ""}`} />
          <span className="text-xs font-medium text-zinc-300">{STATUS_LABELS[status]}</span>
        </div>

        {/* Mode toggle — only when idle */}
        {status === "idle" && (
          <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden">
            <button
              onClick={() => onModeChange("live")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === "live"
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
              }`}
            >
              Live
            </button>
            <button
              onClick={() => onModeChange("replay")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === "replay"
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
              }`}
            >
              Replay
            </button>
          </div>
        )}

        {/* Controls */}
        {status === "idle" && (
          <button
            onClick={onStart}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            ▶ {mode === "replay" ? "Start Replay" : "Start"}
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

        {/* Speed selector — only in replay mode while running or paused */}
        {isReplayActive && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 mr-1">Speed:</span>
            {REPLAY_SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                  replaySpeed === s
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        {status !== "idle" && (
          <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
            <span>{tickCount.toLocaleString()} ticks</span>
            {startedAt && <span>{elapsedStr}</span>}
          </div>
        )}
      </div>

      {/* Replay info row */}
      {mode === "replay" && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Replay date chip */}
          {replay.replayDate && (
            <div className="rounded border border-amber-700/50 bg-amber-900/20 px-2 py-0.5 text-xs text-amber-400">
              Replaying: {replay.replayDate}
            </div>
          )}

          {/* Progress */}
          {showReplayProgress && (
            <>
              <span className="text-xs text-zinc-400">
                Bar {replay.barIndex} / {replay.totalBars}
              </span>
              {replay.replayTimestamp !== null && (
                <span className="text-xs text-zinc-500">
                  {formatReplayTimestamp(replay.replayTimestamp)}
                </span>
              )}
              {replay.isComplete && (
                <div className="rounded border border-emerald-700/50 bg-emerald-900/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  Replay complete
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
