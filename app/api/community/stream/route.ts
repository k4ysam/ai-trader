import { CommunitySimulator } from "@/lib/community/simulator"
import { CommunityBroadcaster } from "@/lib/community/broadcaster"
import type { CommunityState } from "@/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  // Ensure simulator is ticking (idempotent — safe to call on every connection)
  CommunitySimulator.getInstance().start()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function send(state: CommunityState): void {
        const payload = `data: ${JSON.stringify(state)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      // Send last known state immediately so the client has data on connect
      const current = CommunityBroadcaster.getInstance().getLastState()
      if (current) send(current)

      const unsubscribe = CommunityBroadcaster.getInstance().subscribe(send)

      // Keepalive every 15s to prevent proxy timeouts
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"))
      }, 15_000)

      request.signal.addEventListener("abort", () => {
        unsubscribe()
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
