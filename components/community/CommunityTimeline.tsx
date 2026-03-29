"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { Ticker, HistoryPoint } from "@/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommunityTimelineProps {
  ticker: Ticker
}

type WindowOption = "1H" | "6H" | "24H"

interface HistoryResponse {
  ticker: string
  window: string
  points: HistoryPoint[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(tsMs: number): string {
  const d = new Date(tsMs)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function windowParam(w: WindowOption): string {
  return w.toLowerCase()
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  // Extract totalBots from the raw data point via the payload entry
  // Recharts passes the full data record on payload[0]?.payload
  const raw = (payload[0] as { payload?: HistoryPoint })?.payload
  const totalBots = raw?.totalBots ?? 0

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && (
        <p className="mb-1.5 font-medium text-zinc-400">{formatTime(label)}</p>
      )}
      {payload.map((entry) => {
        const labelMap: Record<string, string> = {
          bullPct: "BUY",
          holdPct: "HOLD",
          bearPct: "SELL",
        }
        const displayName = labelMap[entry.name] ?? entry.name
        return (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-zinc-400">{displayName}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums text-white">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        )
      })}
      <p className="mt-1.5 border-t border-zinc-700 pt-1.5 text-zinc-500">
        {totalBots.toLocaleString()} bots
      </p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[80, 60, 90, 50, 70, 55, 85].map((h, i) => (
        <div
          key={i}
          className="rounded bg-zinc-800/60"
          style={{ height: `${h / 7}rem`, width: "100%" }}
        />
      ))}
    </div>
  )
}

// ─── CommunityTimeline ────────────────────────────────────────────────────────

export default function CommunityTimeline({ ticker }: CommunityTimelineProps) {
  const [activeWindow, setActiveWindow] = useState<WindowOption>("1H")
  const [points, setPoints] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchHistory = useCallback(
    async (window: WindowOption) => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(
          `/api/community/history?ticker=${encodeURIComponent(ticker)}&window=${windowParam(window)}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as HistoryResponse
        setPoints(data.points)
      } catch {
        setError(true)
        setPoints([])
      } finally {
        setLoading(false)
      }
    },
    [ticker]
  )

  useEffect(() => {
    void fetchHistory(activeWindow)
  }, [fetchHistory, activeWindow])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const lastPoint = points.length > 0 ? points[points.length - 1] : null

  const WINDOWS: WindowOption[] = ["1H", "6H", "24H"]

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
      {/* Title row */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-white">
          {ticker} Sentiment History
        </h3>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setActiveWindow(w)}
              className={[
                "rounded px-2 py-1 text-xs transition-colors",
                activeWindow === w
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      {loading ? (
        <TimelineSkeleton />
      ) : error || points.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
          No historical data yet. History builds up over time.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={points} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />

            {/* BUY — emerald */}
            <Area
              type="monotone"
              dataKey="bullPct"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.7}
              strokeWidth={1.5}
            />
            {/* HOLD — zinc */}
            <Area
              type="monotone"
              dataKey="holdPct"
              stackId="1"
              stroke="#71717a"
              fill="#71717a"
              fillOpacity={0.5}
              strokeWidth={1.5}
            />
            {/* SELL — rose */}
            <Area
              type="monotone"
              dataKey="bearPct"
              stackId="1"
              stroke="#f43f5e"
              fill="#f43f5e"
              fillOpacity={0.7}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Summary row */}
      {lastPoint && !loading && !error && (
        <div className="mt-3 flex items-center gap-4 border-t border-zinc-800/60 pt-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">BUY</span>
            <span className="ml-1 font-medium tabular-nums text-emerald-400">
              {lastPoint.bullPct.toFixed(1)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-500" />
            <span className="text-zinc-400">HOLD</span>
            <span className="ml-1 font-medium tabular-nums text-zinc-300">
              {lastPoint.holdPct.toFixed(1)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-zinc-400">SELL</span>
            <span className="ml-1 font-medium tabular-nums text-rose-400">
              {lastPoint.bearPct.toFixed(1)}%
            </span>
          </span>
          <span className="ml-auto text-zinc-600">
            {lastPoint.totalBots.toLocaleString()} bots
          </span>
        </div>
      )}
    </div>
  )
}
