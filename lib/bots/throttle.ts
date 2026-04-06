type ThrottledFn<T> = (ticker: string, fn: () => Promise<T>) => Promise<T>

interface CacheEntry<T> {
  result: T
  calledAt: number
}

export function createThrottle<T>(intervalMs: number): ThrottledFn<T> {
  const cache = new Map<string, CacheEntry<T>>()

  return async function throttle(
    ticker: string,
    fn: () => Promise<T>
  ): Promise<T> {
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
