import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "events"

// ─── Mock `ws` module ────────────────────────────────────────────────────────

class MockWebSocket extends EventEmitter {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  sentMessages: string[] = []

  send(data: string) {
    this.sentMessages.push(data)
  }

  terminate() {
    this.emit("close")
  }
}

vi.mock("ws", () => ({ default: MockWebSocket }))

// Import after mock
const { StreamManager } = await import("./stream-manager")

// Helper to get internal ws from a StreamManager instance
function getWs(mgr: InstanceType<typeof StreamManager>): MockWebSocket {
  return (mgr as unknown as { ws: MockWebSocket }).ws
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.ALPACA_API_KEY = "test-key"
  process.env.ALPACA_API_SECRET = "test-secret"
  delete globalThis.__streamManager
})

afterEach(() => {
  delete process.env.ALPACA_API_KEY
  delete process.env.ALPACA_API_SECRET
  globalThis.__streamManager?.destroy()
  delete globalThis.__streamManager
  vi.restoreAllMocks()
})

describe("StreamManager", () => {
  it("getInstance returns the same instance", () => {
    const a = StreamManager.getInstance()
    const b = StreamManager.getInstance()
    expect(a).toBe(b)
  })

  it("sends auth message on websocket open", () => {
    const mgr = new StreamManager()
    mgr.connect(["NVDA"])

    const ws = getWs(mgr)
    ws.emit("open")

    expect(ws.sentMessages).toHaveLength(1)
    const authMsg = JSON.parse(ws.sentMessages[0])
    expect(authMsg).toMatchObject({
      action: "auth",
      key: "test-key",
      secret: "test-secret",
    })
  })

  it("subscribes after successful auth", () => {
    const mgr = new StreamManager()
    mgr.connect(["NVDA", "AAPL"])

    const ws = getWs(mgr)
    ws.emit("open")
    ws.emit("message", JSON.stringify([{ T: "success", msg: "authenticated" }]))

    expect(ws.sentMessages).toHaveLength(2)
    const subMsg = JSON.parse(ws.sentMessages[1])
    expect(subMsg).toMatchObject({
      action: "subscribe",
      trades: ["NVDA", "AAPL"],
    })
  })

  it("emits tick event on trade message", () => {
    const mgr = new StreamManager()
    mgr.connect(["NVDA"])

    const ws = getWs(mgr)
    ws.emit("open")
    ws.emit("message", JSON.stringify([{ T: "success", msg: "authenticated" }]))

    const tickHandler = vi.fn()
    mgr.on("tick", tickHandler)

    ws.emit(
      "message",
      JSON.stringify([
        { T: "t", S: "NVDA", p: 875.5, s: 100, t: "2024-01-15T14:30:00Z" },
      ])
    )

    expect(tickHandler).toHaveBeenCalledOnce()
    const tick = tickHandler.mock.calls[0][0]
    expect(tick).toMatchObject({
      ticker: "NVDA",
      price: 875.5,
      volume: 100,
    })
  })

  it("ignores non-trade messages", () => {
    const mgr = new StreamManager()
    mgr.connect(["NVDA"])

    const ws = getWs(mgr)
    ws.emit("open")

    const tickHandler = vi.fn()
    mgr.on("tick", tickHandler)

    // status/bar messages — should not produce ticks
    ws.emit("message", JSON.stringify([{ T: "success", msg: "connected" }]))
    ws.emit("message", JSON.stringify([{ T: "b", S: "NVDA", o: 870 }]))

    expect(tickHandler).not.toHaveBeenCalled()
  })

  it("throws when env vars are missing", () => {
    delete process.env.ALPACA_API_KEY
    const mgr = new StreamManager()
    expect(() => mgr.connect()).toThrow("ALPACA_API_KEY")
  })
})
