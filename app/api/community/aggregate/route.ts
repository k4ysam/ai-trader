import { CommunityBroadcaster } from "@/lib/community/broadcaster"
import { CommunitySimulator } from "@/lib/community/simulator"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  // Ensure simulator is running before responding
  CommunitySimulator.getInstance().start()

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
