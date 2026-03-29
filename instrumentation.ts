export async function register() {
  // Only run in the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { Orchestrator } = await import("@/lib/orchestrator")
  const orchestrator = Orchestrator.getInstance()

  // Auto-start if Alpaca keys are present; otherwise wait for manual /api/sim/start
  if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
    orchestrator.start()
  }

  // Start community simulator (Phase 1 — simulated community data)
  const { CommunitySimulator } = await import("@/lib/community/simulator")
  CommunitySimulator.getInstance().start()
}
