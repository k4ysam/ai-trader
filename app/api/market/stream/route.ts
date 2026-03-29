import { Orchestrator } from "@/lib/orchestrator"
import { StateBroadcaster } from "@/lib/state-broadcaster"
import type { SimState } from "@/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function send(data: SimState): void {
        const payload = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      // Send current state immediately on connect
      send(Orchestrator.getInstance().getState())

      const unsubscribe = StateBroadcaster.getInstance().subscribe(send)

      // Heartbeat every 15s to keep proxies alive
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
