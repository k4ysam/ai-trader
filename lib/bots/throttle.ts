import type { StrategySignal } from "@/lib/strategies/types"

type ThrottledFn = (
  ticker: string,
  fn: () => Promise<StrategySignal>
) => Promise<StrategySignal>

interface CacheEntry {
  result: StrategySignal
  calledAt: number
}

export function createThrottle(intervalMs: number): ThrottledFn {
  const cache = new Map<string, CacheEntry>()

  return async function throttle(
    ticker: string,
    fn: () => Promise<StrategySignal>
  ): Promise<StrategySignal> {
    const now = Date.now()
    const entry = cache.get(ticker)

    if (entry && now - entry.calledAt < intervalMs) {
      return entry.result
    }

    const result = await fn()
    cache.set(ticker, { result, calledAt: now })
    return result
  }
}
