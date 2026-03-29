import { CommunityBroadcaster } from "./broadcaster"
import { ensureSchema, writeAggregate, isPostgresConfigured } from "./history-store"

// ─── Singleton guard ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __historyWriter: HistoryWriter | undefined
  // eslint-disable-next-line no-var
  var __historyWriterInterval: ReturnType<typeof setInterval> | undefined
}

const SNAPSHOT_INTERVAL_MS = 60_000 // write one row per ticker per minute

// ─── HistoryWriter ────────────────────────────────────────────────────────────

/**
 * Subscribes to CommunityBroadcaster and persists each broadcast's aggregates
 * to Postgres once per minute (debounced — not every 5-second SSE push).
 *
 * No-ops when DATABASE_URL is not configured.
 */
export class HistoryWriter {
  private lastWriteAt = 0

  start(): void {
    if (!isPostgresConfigured()) return

    // Ensure schema exists — fire-and-forget on startup
    ensureSchema().catch(() => null)

    // Clear any prior interval (HMR safety)
    if (globalThis.__historyWriterInterval) {
      clearInterval(globalThis.__historyWriterInterval)
    }

    // Poll: every 60 s, flush the last known state to Postgres
    const interval = setInterval(() => void this.flush(), SNAPSHOT_INTERVAL_MS)
    globalThis.__historyWriterInterval = interval
  }

  stop(): void {
    if (globalThis.__historyWriterInterval) {
      clearInterval(globalThis.__historyWriterInterval)
      globalThis.__historyWriterInterval = undefined
    }
  }

  private async flush(): Promise<void> {
    const state = CommunityBroadcaster.getInstance().getLastState()
    if (!state) return

    const now = Date.now()
    if (now - this.lastWriteAt < SNAPSHOT_INTERVAL_MS - 1_000) return // debounce
    this.lastWriteAt = now

    for (const aggregate of Object.values(state.aggregates)) {
      if (!aggregate || aggregate.totalBots === 0) continue
      await writeAggregate(aggregate).catch(() => null) // non-fatal
    }
  }

  static getInstance(): HistoryWriter {
    if (!globalThis.__historyWriter) {
      globalThis.__historyWriter = new HistoryWriter()
    }
    return globalThis.__historyWriter
  }
}
