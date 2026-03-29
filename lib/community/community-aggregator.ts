import { RedisStore } from "./store"
import { CommunityBroadcaster } from "./broadcaster"
import { computeCommunityState } from "./aggregator"
import { WATCHLIST } from "@/lib/constants"

// ─── Singleton guard ──────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __communityAggregator: CommunityAggregator | undefined
  // eslint-disable-next-line no-var
  var __communityAggInterval: ReturnType<typeof setInterval> | undefined
}

// ─── CommunityAggregator ──────────────────────────────────────────────────────

/**
 * Reads real bot snapshots from Redis every 5 s, computes CommunityState,
 * and publishes it to CommunityBroadcaster.
 *
 * Used in Phase 2 when UPSTASH_REDIS_REST_URL is configured.
 * CommunitySimulator is the fallback for local dev without Redis.
 */
export class CommunityAggregator {
  private store = new RedisStore()

  start(): void {
    // Clear any prior interval to survive HMR
    if (globalThis.__communityAggInterval) {
      clearInterval(globalThis.__communityAggInterval)
    }
    const interval = setInterval(() => void this.tick(), 5_000)
    globalThis.__communityAggInterval = interval
    // Initial tick immediately
    void this.tick()
  }

  stop(): void {
    if (globalThis.__communityAggInterval) {
      clearInterval(globalThis.__communityAggInterval)
      globalThis.__communityAggInterval = undefined
    }
  }

  private async tick(): Promise<void> {
    try {
      const [allSnapshots, trades] = await Promise.all([
        this.store.readAllSnapshots(),
        this.store.readRecentTrades(50),
      ])

      // Group snapshots by ticker
      const byTicker = new Map<string, typeof allSnapshots>()
      for (const snap of allSnapshots) {
        const existing = byTicker.get(snap.ticker) ?? []
        existing.push(snap)
        byTicker.set(snap.ticker, existing)
      }

      const state = computeCommunityState(byTicker, trades, WATCHLIST)
      CommunityBroadcaster.getInstance().publish(state)
    } catch {
      // Redis errors are non-fatal — silently skip this tick
    }
  }

  static getInstance(): CommunityAggregator {
    if (!globalThis.__communityAggregator) {
      globalThis.__communityAggregator = new CommunityAggregator()
    }
    return globalThis.__communityAggregator
  }
}
