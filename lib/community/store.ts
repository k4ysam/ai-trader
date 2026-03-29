import { Redis } from "@upstash/redis"
import type { AnonymousTrade, BotType, CommunityBotSnapshot, Ticker, TradeAction } from "@/types"

// ─── Key helpers ──────────────────────────────────────────────────────────────

const SESSION_KEY = (sessionId: string) => `comm:sess:${sessionId}`
const TRADES_KEY = "comm:trades"
const RATE_LIMIT_KEY = (sessionId: string) => `comm:rl:${sessionId}`
const SESSION_TTL = 300 // seconds — auto-expire idle sessions after 5 min
const TRADES_MAX = 200
const RATE_LIMIT_TTL = 5 // seconds between heartbeats per session

// ─── Lazy singleton ───────────────────────────────────────────────────────────

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set")
    }
    _redis = new Redis({ url, token })
  }
  return _redis
}

// ─── Type guards / serialisation ─────────────────────────────────────────────

const VALID_ACTIONS = new Set<string>(["BUY", "SELL", "HOLD"])
const VALID_BOT_TYPES = new Set<string>([
  "rsi", "sma-crossover", "momentum", "mean-reversion", "ai", "custom",
])

function parseSnapshot(raw: unknown): CommunityBotSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.sessionId !== "string" ||
    typeof r.botType !== "string" || !VALID_BOT_TYPES.has(r.botType) ||
    typeof r.ticker !== "string" ||
    typeof r.lastAction !== "string" || !VALID_ACTIONS.has(r.lastAction) ||
    typeof r.confidence !== "number" ||
    typeof r.pnlPct !== "number" ||
    typeof r.lastTradeTimestamp !== "number" ||
    typeof r.timestamp !== "number"
  ) return null

  return {
    sessionId: r.sessionId,
    botType: r.botType as BotType,
    ticker: r.ticker as Ticker,
    lastAction: r.lastAction as TradeAction,
    confidence: r.confidence,
    pnlPct: r.pnlPct,
    lastTradeTimestamp: r.lastTradeTimestamp,
    timestamp: r.timestamp,
  }
}

function parseTrade(raw: unknown): AnonymousTrade | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.ticker !== "string" ||
    typeof r.action !== "string" || !VALID_ACTIONS.has(r.action) ||
    typeof r.botType !== "string" || !VALID_BOT_TYPES.has(r.botType) ||
    typeof r.confidence !== "number" ||
    typeof r.timestamp !== "number"
  ) return null

  return {
    ticker: r.ticker as Ticker,
    action: r.action as TradeAction,
    botType: r.botType as BotType,
    confidence: r.confidence,
    timestamp: r.timestamp,
  }
}

// ─── CommunityStore ───────────────────────────────────────────────────────────

export interface CommunityStore {
  /**
   * Write a batch of snapshots for one session as a single HSET.
   * Returns the previous lastTradeTimestamp values keyed by `{botType}:{ticker}`
   * so the caller can detect new trades.
   */
  writeSnapshots(
    sessionId: string,
    snapshots: CommunityBotSnapshot[]
  ): Promise<Record<string, number>>

  readAllSnapshots(): Promise<CommunityBotSnapshot[]>

  writeTrade(trade: AnonymousTrade): Promise<void>
  readRecentTrades(limit: number): Promise<AnonymousTrade[]>

  /** Returns true if the request is allowed (false = rate limited). */
  checkRateLimit(sessionId: string): Promise<boolean>
}

// ─── RedisStore ───────────────────────────────────────────────────────────────

export class RedisStore implements CommunityStore {
  private redis = getRedis()

  async writeSnapshots(
    sessionId: string,
    snapshots: CommunityBotSnapshot[]
  ): Promise<Record<string, number>> {
    if (snapshots.length === 0) return {}

    const key = SESSION_KEY(sessionId)

    // Read existing fields to extract previous lastTradeTimestamps
    const existing = await this.redis.hgetall(key)
    const prevTimestamps: Record<string, number> = {}
    if (existing) {
      for (const [field, raw] of Object.entries(existing)) {
        const snap = parseSnapshot(typeof raw === "string" ? JSON.parse(raw) : raw)
        if (snap) prevTimestamps[field] = snap.lastTradeTimestamp
      }
    }

    // Build HSET fields map: field = "{botType}:{ticker}", value = JSON snapshot
    const fields: Record<string, string> = {}
    for (const snap of snapshots) {
      fields[`${snap.botType}:${snap.ticker}`] = JSON.stringify(snap)
    }

    // HSET + EXPIRE in a pipeline to minimise round-trips
    const pipeline = this.redis.pipeline()
    pipeline.hset(key, fields)
    pipeline.expire(key, SESSION_TTL)
    await pipeline.exec()

    return prevTimestamps
  }

  async readAllSnapshots(): Promise<CommunityBotSnapshot[]> {
    const results: CommunityBotSnapshot[] = []

    // SCAN for all session keys — Upstash cursor is a string ("0" = done)
    let cursor: string | number = 0
    do {
      const [nextCursor, keys]: [string, string[]] = await this.redis.scan(cursor, {
        match: "comm:sess:*",
        count: 100,
      })
      cursor = nextCursor

      if (keys.length > 0) {
        // Pipeline HGETALL for each session key
        const pipeline = this.redis.pipeline()
        for (const k of keys) pipeline.hgetall(k)
        const batchResults = await pipeline.exec()

        for (const result of batchResults) {
          if (!result || typeof result !== "object") continue
          for (const raw of Object.values(result as Record<string, unknown>)) {
            const snap = parseSnapshot(typeof raw === "string" ? JSON.parse(raw) : raw)
            if (snap) results.push(snap)
          }
        }
      }
    } while (String(cursor) !== "0")

    return results
  }

  async writeTrade(trade: AnonymousTrade): Promise<void> {
    const pipeline = this.redis.pipeline()
    pipeline.lpush(TRADES_KEY, JSON.stringify(trade))
    pipeline.ltrim(TRADES_KEY, 0, TRADES_MAX - 1)
    await pipeline.exec()
  }

  async readRecentTrades(limit: number): Promise<AnonymousTrade[]> {
    const raws = await this.redis.lrange(TRADES_KEY, 0, limit - 1)
    return raws
      .map((r) => parseTrade(typeof r === "string" ? JSON.parse(r) : r))
      .filter((t): t is AnonymousTrade => t !== null)
  }

  async checkRateLimit(sessionId: string): Promise<boolean> {
    const key = RATE_LIMIT_KEY(sessionId)
    // SET NX EX: only sets if key doesn't exist. Returns "OK" if set, null if already exists.
    const result = await this.redis.set(key, 1, { nx: true, ex: RATE_LIMIT_TTL })
    return result !== null // true = allowed, false = rate limited
  }
}

// ─── isRedisConfigured ────────────────────────────────────────────────────────

/** Returns true when Upstash env vars are present. */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}
