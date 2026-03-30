import { z } from "zod"
import { getStore } from "@/lib/community/store"
import type { AnonymousTrade, CommunityBotSnapshot } from "@/types"

// ─── Zod schema ───────────────────────────────────────────────────────────────

const BOT_TYPES = ["rsi", "sma-crossover", "momentum", "mean-reversion", "ai", "custom"] as const
const TRADE_ACTIONS = ["BUY", "SELL", "HOLD"] as const
const TS_WINDOW_MS = 5 * 60 * 1_000 // ±5 minutes from now

const snapshotSchema = z.object({
  // C-1: restrict sessionId to alphanumeric + hyphen/underscore, min 8 chars
  sessionId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  botType: z.enum(BOT_TYPES),
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/),
  lastAction: z.enum(TRADE_ACTIONS),
  confidence: z.number().min(0).max(1),
  // M-3: cap at ±500% to prevent leaderboard distortion
  pnlPct: z.number().min(-500).max(500),
  // H-2: clamp timestamps to ±5 min window
  lastTradeTimestamp: z.number().int().refine(
    (t) => t > Date.now() - TS_WINDOW_MS && t <= Date.now() + 30_000,
    { message: "lastTradeTimestamp out of acceptable range" }
  ),
  timestamp: z.number().int().refine(
    (t) => t > Date.now() - TS_WINDOW_MS && t <= Date.now() + 30_000,
    { message: "timestamp out of acceptable range" }
  ),
})

const heartbeatSchema = z.object({
  sessionId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  snapshots: z.array(snapshotSchema).min(1).max(20),
})

// ─── POST /api/community/heartbeat ────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // M-5: enforce Content-Type
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Content-Type must be application/json" }, 415)
  }

  // H-3: Origin check — only accept from same origin or allowed origins
  const origin = request.headers.get("origin")
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL ?? ""
  if (origin && allowedOrigin && origin !== allowedOrigin) {
    return json({ error: "Forbidden" }, 403)
  }

  // C-2: IP-level rate limit (60 req/min per IP)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
  const store = getStore()
  const ipAllowed = await store.checkIpRateLimit(ip)
  if (!ipAllowed) {
    return json({ error: "Too many requests" }, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const parsed = heartbeatSchema.safeParse(body)
  if (!parsed.success) {
    // M-2: return generic message — do not leak schema shape
    return json({ error: "Invalid payload" }, 400)
  }

  const { sessionId, snapshots } = parsed.data

  // Per-session rate limit (5 s window)
  const sessionAllowed = await store.checkRateLimit(sessionId)
  if (!sessionAllowed) {
    return json({ error: "Rate limited — wait 5 seconds between heartbeats" }, 429)
  }

  // Write snapshots batch; get previous timestamps for dedup
  const prevTimestamps = await store.writeSnapshots(sessionId, snapshots as CommunityBotSnapshot[])

  // Build and write new trades (H-1: global fingerprint dedup prevents race-condition duplicates)
  const newTradesCount: number[] = []
  for (const snap of snapshots) {
    if (snap.lastAction === "HOLD") continue

    const field = `${snap.botType}:${snap.ticker}`
    const prev = prevTimestamps[field]
    if (prev !== undefined && snap.lastTradeTimestamp === prev) continue

    // Global dedup: fingerprint = botType:ticker:timestamp
    const fingerprint = `${snap.botType}:${snap.ticker}:${snap.lastTradeTimestamp}`
    const isNew = await store.isTradeNew(fingerprint)
    if (!isNew) continue

    const trade: AnonymousTrade = {
      ticker: snap.ticker,
      action: snap.lastAction,
      botType: snap.botType,
      confidence: snap.confidence,
      timestamp: snap.lastTradeTimestamp,
    }
    await store.writeTrade(trade)
    newTradesCount.push(snap.lastTradeTimestamp)
  }

  return json({ ok: true, newTrades: newTradesCount.length })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
