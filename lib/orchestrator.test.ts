import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Orchestrator } from "./orchestrator"
import type { MarketTick } from "@/types"

// ─── Mock StreamManager ───────────────────────────────────────────────────────

const mockStreamOn = vi.fn()
const mockStreamOff = vi.fn()
const mockStreamConnect = vi.fn()
const mockStreamListenerCount = vi.fn().mockReturnValue(0)

vi.mock("@/lib/market/stream-manager", () => ({
  StreamManager: {
    getInstance: () => ({
      on: mockStreamOn,
      off: mockStreamOff,
      connect: mockStreamConnect,
      listenerCount: mockStreamListenerCount,
    }),
  },
}))

// ─── Mock AI bot (avoid Gemini calls) ─────────────────────────────────────────

vi.mock("@/lib/bots/ai-bot", () => ({
  callAIBot: vi.fn().mockResolvedValue({ action: "HOLD", confidence: 0, reasoning: "mocked" }),
  createAIBotConfig: () => ({
    id: "aria-ai-bot",
    name: "ARIA",
    type: "ai",
    emoji: "🤖",
    color: "#8b5cf6",
    params: {},
  }),
  createGeminiGenerateFn: vi.fn().mockReturnValue(undefined),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTick(ticker = "NVDA", price = 150): MarketTick {
  return { ticker, price, volume: 1000, timestamp: Date.now() }
}

function getPrivateState(orc: Orchestrator) {
  return (orc as unknown as { state: ReturnType<Orchestrator["getState"]> }).state
}

function fireOnTick(orc: Orchestrator, tick: MarketTick) {
  const onTick = (orc as unknown as { onTick: (t: MarketTick) => void }).onTick
  onTick.call(orc, tick)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  delete globalThis.__orchestrator
  delete globalThis.__stateBroadcaster
  vi.clearAllMocks()
})

afterEach(() => {
  delete globalThis.__orchestrator
  delete globalThis.__stateBroadcaster
})

describe("Orchestrator", () => {
  it("starts with idle status and DEFAULT_BOTS + AI bot", () => {
    const orc = new Orchestrator()
    const state = orc.getState()
    expect(state.status).toBe("idle")
    expect(state.bots.length).toBeGreaterThanOrEqual(5) // 4 rule-based + 1 AI
    expect(state.bots.some((b) => b.config.type === "ai")).toBe(true)
  })

  it("start() sets status to running and subscribes to stream", () => {
    const orc = new Orchestrator()
    orc.start()
    expect(orc.getState().status).toBe("running")
    expect(mockStreamOn).toHaveBeenCalledWith("tick", expect.any(Function))
  })

  it("pause() sets status to paused and unsubscribes", () => {
    const orc = new Orchestrator()
    orc.start()
    orc.pause()
    expect(orc.getState().status).toBe("paused")
    expect(mockStreamOff).toHaveBeenCalledWith("tick", expect.any(Function))
  })

  it("reset() returns all portfolios to starting balance", () => {
    const orc = new Orchestrator()
    orc.start()
    fireOnTick(orc, makeTick("NVDA", 150))
    orc.reset()
    const state = orc.getState()
    expect(state.status).toBe("idle")
    for (const bot of state.bots) {
      expect(bot.portfolio.cash).toBe(100_000)
      expect(bot.portfolio.totalPnl).toBe(0)
    }
  })

  it("onTick updates priceHistory and snapshots", () => {
    const orc = new Orchestrator()
    orc.start()
    fireOnTick(orc, makeTick("NVDA", 150))
    const state = orc.getState()
    expect(state.priceHistory["NVDA"]).toHaveLength(1)
    expect(state.snapshots["NVDA"]).toMatchObject({ ticker: "NVDA", price: 150 })
    expect(state.tickCount).toBe(1)
  })

  it("onTick is ignored when paused", () => {
    const orc = new Orchestrator()
    orc.start()
    orc.pause()
    fireOnTick(orc, makeTick("NVDA", 150))
    expect(orc.getState().tickCount).toBe(0)
  })

  it("addBot appends a new bot with fresh portfolio", () => {
    const orc = new Orchestrator()
    const before = orc.getState().bots.length
    orc.addBot({ id: "custom-1", name: "Test", type: "rsi", emoji: "🧪", color: "#fff", params: { period: 7 } })
    expect(orc.getState().bots.length).toBe(before + 1)
    expect(orc.getState().bots.find((b) => b.config.id === "custom-1")?.portfolio.cash).toBe(100_000)
  })

  it("removeBot removes the bot by id", () => {
    const orc = new Orchestrator()
    orc.addBot({ id: "custom-2", name: "Test", type: "rsi", emoji: "🧪", color: "#fff", params: {} })
    orc.removeBot("custom-2")
    expect(orc.getState().bots.find((b) => b.config.id === "custom-2")).toBeUndefined()
  })

  it("updateBotParams merges new params", () => {
    const orc = new Orchestrator()
    const botId = orc.getState().bots.find((b) => b.config.type === "rsi")!.config.id
    orc.updateBotParams(botId, { period: 21 })
    const updated = orc.getState().bots.find((b) => b.config.id === botId)!
    expect(updated.config.params.period).toBe(21)
  })

  it("getInstance returns the same instance", () => {
    const a = Orchestrator.getInstance()
    const b = Orchestrator.getInstance()
    expect(a).toBe(b)
  })
})
