const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store — resets on server restart, sufficient for a simulation app.
const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}
