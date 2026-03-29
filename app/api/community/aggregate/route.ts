import { CommunityBroadcaster } from "@/lib/community/broadcaster"
import { CommunitySimulator } from "@/lib/community/simulator"
import { CommunityAggregator } from "@/lib/community/community-aggregator"
import { isRedisConfigured } from "@/lib/community/store"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  // Ensure appropriate engine is running
  if (isRedisConfigured()) {
    CommunityAggregator.getInstance().start()
  } else {
    CommunitySimulator.getInstance().start()
  }

  const state = CommunityBroadcaster.getInstance().getLastState()

  if (!state) {
    return new Response(JSON.stringify({ error: "Community data not yet available" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify(state), {
    headers: { "Content-Type": "application/json" },
  })
}
