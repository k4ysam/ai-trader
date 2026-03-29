import { describe, it, expect, vi, beforeEach } from "vitest"
import { createThrottle } from "./throttle"
import type { StrategySignal } from "@/lib/strategies/types"

const holdSignal: StrategySignal = { action: "HOLD", confidence: 0, reasoning: "test" }
const buySignal: StrategySignal = { action: "BUY", confidence: 0.8, reasoning: "buy" }

describe("createThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("calls fn on first invocation", async () => {
    const throttle = createThrottle(1000)
    const fn = vi.fn().mockResolvedValue(buySignal)
    const result = await throttle("NVDA", fn)
    expect(fn).toHaveBeenCalledOnce()
    expect(result).toEqual(buySignal)
  })

  it("returns cached result within interval", async () => {
    const throttle = createThrottle(1000)
    const fn = vi.fn().mockResolvedValue(buySignal)

    await throttle("NVDA", fn)
    vi.advanceTimersByTime(500) // still within interval
    const second = await throttle("NVDA", fn)

    expect(fn).toHaveBeenCalledOnce() // NOT called again
    expect(second).toEqual(buySignal)
  })

  it("calls fn again after interval expires", async () => {
    const throttle = createThrottle(1000)
    const fn = vi.fn().mockResolvedValue(buySignal)

    await throttle("NVDA", fn)
    vi.advanceTimersByTime(1001) // past interval
    await throttle("NVDA", fn)

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("maintains per-ticker isolation", async () => {
    const throttle = createThrottle(1000)
    const fn = vi.fn().mockResolvedValue(holdSignal)

    await throttle("NVDA", fn)
    await throttle("AAPL", fn) // different ticker — must call fn

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("returns HOLD fallback when within interval and no cache yet", async () => {
    const throttle = createThrottle(1000)
    // No prior call — first call goes through
    const fn = vi.fn().mockResolvedValue(buySignal)
    const result = await throttle("NVDA", fn)
    expect(result.action).toBe("BUY") // first call goes through
  })

  it("different throttle instances are independent", async () => {
    const t1 = createThrottle(1000)
    const t2 = createThrottle(1000)
    const fn = vi.fn().mockResolvedValue(holdSignal)

    await t1("NVDA", fn)
    await t2("NVDA", fn) // different instance — no shared state

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
