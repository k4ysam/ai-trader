"use client"

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import type { PriceBar } from "@/types"

interface PriceChartProps {
  ticker: string
  bars: PriceBar[]
}

interface ChartPoint {
  time: string
  price: number
}

export default function PriceChart({ ticker, bars }: PriceChartProps) {
  if (bars.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 flex items-center justify-center h-[220px]">
        <p className="text-xs text-zinc-600">Waiting for price data for {ticker}…</p>
      </div>
    )
  }

  const data: ChartPoint[] = bars.map((b) => ({
    time: new Date(b.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    price: b.close,
  }))

  const prices = data.map((d) => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = Math.max((max - min) * 0.15, 1)
  const first = prices[0]
  const last = prices[prices.length - 1]
  const trendUp = last >= first
  const strokeColor = trendUp ? "#10b981" : "#ef4444"
  const gradientId = trendUp ? `grad-up-${ticker}` : `grad-down-${ticker}`

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 panel-depth">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {ticker} · Price
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-up-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`grad-down-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            width={55}
          />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff", fontSize: 11 }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]}
          />
          <ReferenceLine
            y={first}
            stroke="#52525b"
            strokeDasharray="4 4"
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: strokeColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
