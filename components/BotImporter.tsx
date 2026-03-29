"use client"

import { useState } from "react"
import type { BotType } from "@/types"

interface BotImporterProps {
  onImport: (payload: {
    name: string
    type: BotType
    params: Record<string, number>
    emoji: string
    color: string
  }) => void
  onClose: () => void
}

type RuleType = Exclude<BotType, "ai" | "custom">

const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: "rsi", label: "RSI" },
  { value: "sma-crossover", label: "SMA Crossover" },
  { value: "momentum", label: "Momentum" },
  { value: "mean-reversion", label: "Mean Reversion" },
]

const DEFAULT_PARAMS: Record<RuleType, Record<string, number>> = {
  rsi: { period: 14, overbought: 70, oversold: 30 },
  "sma-crossover": { fastPeriod: 10, slowPeriod: 30 },
  momentum: { lookback: 20, threshold: 0.02 },
  "mean-reversion": { period: 20, stdDevMultiplier: 2.0 },
}

const EMOJIS = ["🤖", "🦊", "🐉", "🦁", "🐺", "🦅", "⚡", "🎯", "🔥", "💎"]
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

export default function BotImporter({ onImport, onClose }: BotImporterProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<RuleType>("rsi")
  const [params, setParams] = useState<Record<string, number>>(DEFAULT_PARAMS.rsi)
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState<string | null>(null)

  function handleTypeChange(newType: RuleType) {
    setType(newType)
    setParams(DEFAULT_PARAMS[newType])
  }

  function handleParamChange(key: string, value: string) {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      setParams((prev) => ({ ...prev, [key]: num }))
    }
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("Bot name is required")
      return
    }
    setError(null)
    onImport({ name: name.trim(), type, params, emoji, color })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Add Bot</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1">Bot Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Trader"
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>

        {/* Type */}
        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1">Strategy</label>
          <div className="grid grid-cols-2 gap-2">
            {RULE_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleTypeChange(value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  type === value
                    ? "border-zinc-600 bg-zinc-800 text-white"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Params */}
        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-2">Parameters</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(params).map(([key, val]) => (
              <div key={key}>
                <label className="block text-[10px] text-zinc-600 mb-1">{key}</label>
                <input
                  type="number"
                  step="any"
                  value={val}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Emoji + color */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Emoji</label>
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-lg rounded p-0.5 ${emoji === e ? "bg-zinc-700" : "hover:bg-zinc-800"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Color</label>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 py-2 text-sm font-semibold text-white transition-colors"
          >
            Add Bot
          </button>
        </div>
      </div>
    </div>
  )
}
