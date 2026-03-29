"use client"

import { useEffect, useRef } from "react"
import type { BotState, Order } from "@/types"

interface TradeFeedProps {
  bots: BotState[]
}

interface EnrichedOrder extends Order {
  botEmoji: string
  botName: string
  botColor: string
}

export default function TradeFeed({ bots }: TradeFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Collect all orders across bots, sorted newest first
  const allOrders: EnrichedOrder[] = []
  for (const bot of bots) {
    for (const order of bot.portfolio.tradeHistory) {
      allOrders.push({
        ...order,
        botEmoji: bot.config.emoji,
        botName: bot.config.name,
        botColor: bot.config.color,
      })
    }
  }
  allOrders.sort((a, b) => b.timestamp - a.timestamp)
  const recent = allOrders.slice(0, 50)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [recent.length])

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800/60 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Trade Feed
          {recent.length > 0 && (
            <span className="ml-2 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {allOrders.length}
            </span>
          )}
        </p>
      </div>

      <div ref={scrollRef} className="overflow-y-auto max-h-80 divide-y divide-zinc-800/40">
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">
            Trades will appear here once the simulation starts
          </div>
        ) : (
          recent.map((order, i) => (
            <div
              key={`${order.botId}-${order.timestamp}-${i}`}
              className="flex items-start gap-3 px-4 py-2.5 animate-fadeIn"
            >
              <span className="text-base leading-none mt-0.5">{order.botEmoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: order.botColor }}>
                    {order.botName}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      order.action === "BUY"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {order.action}
                  </span>
                  <span className="text-xs text-white">
                    {order.qty} {order.ticker} @ ${order.price.toFixed(2)}
                  </span>
                </div>
                {order.reasoning && (
                  <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1">{order.reasoning}</p>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">
                {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
