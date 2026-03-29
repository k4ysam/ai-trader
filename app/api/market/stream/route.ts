import { StreamManager } from "@/lib/market/stream-manager"
import type { MarketTick } from "@/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      function send(event: string, data: unknown): void {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      // Send initial keepalive so the connection is established immediately
      controller.enqueue(encoder.encode(": keepalive\n\n"))

      const manager = StreamManager.getInstance()

      function onTick(tick: MarketTick): void {
        send("tick", tick)
      }

      manager.on("tick", onTick)

      // Heartbeat every 15s to keep proxies from closing the connection
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"))
      }, 15_000)

      request.signal.addEventListener("abort", () => {
        manager.off("tick", onTick)
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
