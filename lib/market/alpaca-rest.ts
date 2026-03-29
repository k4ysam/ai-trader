import { z } from "zod"
import { ALPACA_DATA_BASE_URL } from "@/lib/constants"
import type { MarketSnapshot, PriceBar, Ticker } from "@/types"

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const alpacaSnapshotSchema = z.object({
  latestTrade: z.object({ p: z.number() }).optional(),
  dailyBar: z
    .object({
      o: z.number(),
      h: z.number(),
      l: z.number(),
      c: z.number(),
    })
    .optional(),
  prevDailyBar: z.object({ c: z.number() }).optional(),
})

const alpacaBarSchema = z.object({
  t: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const key = process.env.ALPACA_API_KEY
  const secret = process.env.ALPACA_API_SECRET
  if (!key || !secret) {
    throw new Error("ALPACA_API_KEY and ALPACA_API_SECRET must be configured")
  }
  return {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
  }
}

function parseSnapshot(ticker: Ticker, raw: unknown): MarketSnapshot {
  const parsed = alpacaSnapshotSchema.parse(raw)
  const price = parsed.latestTrade?.p ?? parsed.dailyBar?.c ?? 0
  const open = parsed.dailyBar?.o ?? price
  const high = parsed.dailyBar?.h ?? price
  const low = parsed.dailyBar?.l ?? price
  const prevClose = parsed.prevDailyBar?.c ?? price
  const change = price - prevClose
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0

  return { ticker, price, open, high, low, prevClose, change, changePercent }
}

function parseBar(raw: unknown): PriceBar {
  const parsed = alpacaBarSchema.parse(raw)
  return {
    time: new Date(parsed.t).getTime(),
    open: parsed.o,
    high: parsed.h,
    low: parsed.l,
    close: parsed.c,
    volume: parsed.v,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSnapshots(
  tickers: string[]
): Promise<Record<string, MarketSnapshot>> {
  if (tickers.length === 0) return {}

  const symbols = tickers.join(",")
  const url = `${ALPACA_DATA_BASE_URL}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols)}&feed=iex`

  const res = await fetch(url, { headers: getAuthHeaders() })

  if (!res.ok) {
    throw new Error(
      `Alpaca snapshots request failed: ${res.status} ${res.statusText}`
    )
  }

  const body: unknown = await res.json()
  if (typeof body !== "object" || body === null) {
    throw new Error("Unexpected snapshot response shape")
  }

  const result: Record<string, MarketSnapshot> = {}
  for (const ticker of tickers) {
    const raw = (body as Record<string, unknown>)[ticker]
    if (raw !== undefined) {
      try {
        result[ticker] = parseSnapshot(ticker, raw)
      } catch {
        // Skip tickers that fail parsing — partial results are fine
      }
    }
  }
  return result
}

export async function getBars(
  ticker: string,
  limit: number
): Promise<PriceBar[]> {
  const url = `${ALPACA_DATA_BASE_URL}/v2/stocks/${encodeURIComponent(ticker)}/bars?timeframe=1Min&limit=${limit}&feed=iex`

  const res = await fetch(url, { headers: getAuthHeaders() })

  if (!res.ok) {
    throw new Error(
      `Alpaca bars request failed: ${res.status} ${res.statusText}`
    )
  }

  const body: unknown = await res.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).bars)
  ) {
    throw new Error("Unexpected bars response shape")
  }

  const bars = (body as { bars: unknown[] }).bars
  const result: PriceBar[] = []
  for (const raw of bars) {
    try {
      result.push(parseBar(raw))
    } catch {
      // Skip malformed bars
    }
  }
  return result
}
