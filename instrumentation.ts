export async function register() {
  // Only run in the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { Orchestrator } = await import("@/lib/orchestrator")
  const orchestrator = Orchestrator.getInstance()

  // Auto-start if Alpaca keys are present; otherwise wait for manual /api/sim/start
  if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
    orchestrator.start()
  }

  // Start community engine: real Redis aggregation when configured, simulator otherwise
  const { isRedisConfigured } = await import("@/lib/community/store")
  if (isRedisConfigured()) {
    const { CommunityAggregator } = await import("@/lib/community/community-aggregator")
    CommunityAggregator.getInstance().start()
  } else {
    const { CommunitySimulator } = await import("@/lib/community/simulator")
    CommunitySimulator.getInstance().start()
  }

  // Start history writer — persists aggregates to Postgres every 60s (no-op without DATABASE_URL)
  const { HistoryWriter } = await import("@/lib/community/history-writer")
  HistoryWriter.getInstance().start()
}
