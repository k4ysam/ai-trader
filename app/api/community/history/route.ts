import { readHistory, isPostgresConfigured, type WindowOption } from "@/lib/community/history-store"
import { WATCHLIST } from "@/lib/constants"

export const dynamic = "force-dynamic"

const VALID_WINDOWS = new Set<string>(["1h", "6h", "24h"])

export async function GET(request: Request): Promise<Response> {
  if (!isPostgresConfigured()) {
    return json({ error: "History not available — DATABASE_URL not configured" }, 503)
  }

  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")
  const window = searchParams.get("window") ?? "1h"

  if (!ticker || !WATCHLIST.includes(ticker)) {
    return json({ error: "Invalid or missing ticker" }, 400)
  }
  if (!VALID_WINDOWS.has(window)) {
    return json({ error: "Invalid window — use 1h, 6h, or 24h" }, 400)
  }

  try {
    const points = await readHistory(ticker, window as WindowOption)
    return json({ ticker, window, points })
  } catch {
    return json({ error: "Failed to read history" }, 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
