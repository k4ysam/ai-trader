import { neon } from "@neondatabase/serverless"
import type { CommunityAggregate, HistoryPoint, Ticker } from "@/types"

// ─── Client ───────────────────────────────────────────────────────────────────

let _sql: ReturnType<typeof neon> | null = null

function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL must be set for community history")
    _sql = neon(url)
  }
  return _sql
}

export function isPostgresConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

// ─── Schema migration ─────────────────────────────────────────────────────────

/**
 * Idempotent — safe to call on every server boot.
 * Creates the table and index if they don't already exist.
 */
export async function ensureSchema(): Promise<void> {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS community_snapshots (
      id          BIGSERIAL PRIMARY KEY,
      ticker      TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      bull_pct    NUMERIC(5,2),
      bear_pct    NUMERIC(5,2),
      hold_pct    NUMERIC(5,2),
      total_bots  INTEGER,
      data        JSONB
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS community_snapshots_ticker_time_idx
      ON community_snapshots (ticker, captured_at DESC)
  `
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function writeAggregate(aggregate: CommunityAggregate): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO community_snapshots (ticker, bull_pct, bear_pct, hold_pct, total_bots, data)
    VALUES (
      ${aggregate.ticker},
      ${aggregate.bullPct},
      ${aggregate.bearPct},
      ${aggregate.holdPct},
      ${aggregate.totalBots},
      ${JSON.stringify(aggregate)}
    )
  `
}

// ─── Read ─────────────────────────────────────────────────────────────────────

type WindowOption = "1h" | "6h" | "24h"

const WINDOW_INTERVALS: Record<WindowOption, string> = {
  "1h": "1 hour",
  "6h": "6 hours",
  "24h": "24 hours",
}

/**
 * Returns time-bucketed history points for a ticker.
 * Bucket granularity scales with window: 1h → 1-min buckets, 6h → 5-min, 24h → 15-min.
 */
export async function readHistory(
  ticker: Ticker,
  window: WindowOption = "1h"
): Promise<HistoryPoint[]> {
  const sql = getSql()
  const interval = WINDOW_INTERVALS[window]

  // Bucket granularity
  const bucketSeconds = window === "1h" ? 60 : window === "6h" ? 300 : 900

  type Row = { ts: unknown; bull_pct: unknown; bear_pct: unknown; hold_pct: unknown; total_bots: unknown }

  const rows = (await sql`
    SELECT
      extract(epoch FROM date_trunc('second',
        to_timestamp(floor(extract(epoch FROM captured_at) / ${bucketSeconds}) * ${bucketSeconds})
      )) * 1000 AS ts,
      round(avg(bull_pct)::numeric, 2)  AS bull_pct,
      round(avg(bear_pct)::numeric, 2)  AS bear_pct,
      round(avg(hold_pct)::numeric, 2)  AS hold_pct,
      round(avg(total_bots))::int       AS total_bots
    FROM community_snapshots
    WHERE ticker = ${ticker}
      AND captured_at >= now() - ${interval}::interval
    GROUP BY ts
    ORDER BY ts ASC
  `) as Row[]

  return rows.map((r) => ({
    timestamp: Number(r.ts),
    bullPct: Number(r.bull_pct),
    bearPct: Number(r.bear_pct),
    holdPct: Number(r.hold_pct),
    totalBots: Number(r.total_bots),
  }))
}

export type { WindowOption }
