"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { STARTING_PRICE } from "@/lib/constants";

interface PriceChartProps {
  data: { time: string; price: number }[];
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  dataLength: number;
  color: string;
}

function PulsingDot({ cx, cy, index, dataLength, color }: DotProps) {
  if (index !== dataLength - 1 || cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} />
      <circle cx={cx} cy={cy} r={4} fill={color} opacity={0.5}>
        <animate attributeName="r" from="4" to="14" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

export default function PriceChart({ data }: PriceChartProps) {
  if (data.length < 2) return null;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max((max - min) * 0.15, 8);

  const latestPrice = data[data.length - 1].price;
  const trendUp = latestPrice >= STARTING_PRICE;
  const strokeColor = trendUp ? "#10b981" : "#ef4444";
  const gradientId = trendUp ? "gradientGreen" : "gradientRed";

  return (
    <div className="mask-fade-bottom rounded-xl border border-zinc-800/60 bg-zinc-900 p-4 panel-depth ring-1 ring-white/5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Price History
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#27272a"
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
          />
          <ReferenceLine
            y={STARTING_PRICE}
            stroke="#52525b"
            strokeDasharray="4 4"
            label={{ value: `Start $${STARTING_PRICE}`, fill: "#52525b", fontSize: 10, position: "insideTopLeft" }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={(props: Record<string, unknown>) => (
              <PulsingDot
                key={props.index as number}
                cx={props.cx as number}
                cy={props.cy as number}
                index={props.index as number}
                dataLength={data.length}
                color={strokeColor}
              />
            )}
            activeDot={{ r: 5, fill: strokeColor, stroke: "transparent" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
