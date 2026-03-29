import { z } from "zod"
import { RedisStore } from "@/lib/community/store"
import type { AnonymousTrade, CommunityBotSnapshot } from "@/types"

// ─── Zod schema ───────────────────────────────────────────────────────────────

const BOT_TYPES = ["rsi", "sma-crossover", "momentum", "mean-reversion", "ai", "custom"] as const
const TRADE_ACTIONS = ["BUY", "SELL", "HOLD"] as const

const snapshotSchema = z.object({
  sessionId: z.string().min(1).max(64),
  botType: z.enum(BOT_TYPES),
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/),
  lastAction: z.enum(TRADE_ACTIONS),
  confidence: z.number().min(0).max(1),
  pnlPct: z.number().min(-1000).max(1000),
  lastTradeTimestamp: z.number().int().positive(),
  timestamp: z.number().int().positive(),
})

const heartbeatSchema = z.object({
  sessionId: z.string().min(1).max(64),
  snapshots: z.array(snapshotSchema).min(1).max(20),
})

// ─── POST /api/community/heartbeat ────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const parsed = heartbeatSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400)
  }

  const { sessionId, snapshots } = parsed.data

  const store = new RedisStore()

  // 1. Rate limit — one heartbeat per 5 s per session
  const allowed = await store.checkRateLimit(sessionId)
  if (!allowed) {
    return json({ error: "Rate limited — wait 5 seconds between heartbeats" }, 429)
  }

  // 2. Write snapshots (batch HSET); receive previous lastTradeTimestamps for dedup
  const prevTimestamps = await store.writeSnapshots(sessionId, snapshots as CommunityBotSnapshot[])

  // 3. For each non-HOLD snapshot where lastTradeTimestamp changed → new trade
  const newTrades: AnonymousTrade[] = []
  for (const snap of snapshots) {
    if (snap.lastAction === "HOLD") continue
    const field = `${snap.botType}:${snap.ticker}`
    const prev = prevTimestamps[field]
    if (prev === undefined || snap.lastTradeTimestamp !== prev) {
      newTrades.push({
        ticker: snap.ticker,
        action: snap.lastAction,
        botType: snap.botType,
        confidence: snap.confidence,
        timestamp: snap.lastTradeTimestamp,
      })
    }
  }

  // 4. Persist new trades
  for (const trade of newTrades) {
    await store.writeTrade(trade)
  }

  return json({ ok: true, newTrades: newTrades.length })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
