"use client"

import { useEffect, useRef } from "react"
import type { BotState, CommunityBotSnapshot, SimState, Ticker } from "@/types"

// ─── Session ID ───────────────────────────────────────────────────────────────

const SESSION_KEY = "community_session_id"
const SESSION_CREATED_KEY = "community_session_created"
const SESSION_TTL_MS = 60 * 60 * 1000 // rotate hourly

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    const created = Number(localStorage.getItem(SESSION_CREATED_KEY) ?? 0)
    if (existing && Date.now() - created < SESSION_TTL_MS) return existing

    // Generate new session ID
    const newId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    localStorage.setItem(SESSION_KEY, newId)
    localStorage.setItem(SESSION_CREATED_KEY, String(Date.now()))
    return newId
  } catch {
    // SSR / localStorage unavailable — return a throwaway ID
    return `ssr-${Date.now()}`
  }
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function buildSnapshots(
  sessionId: string,
  bots: BotState[]
): CommunityBotSnapshot[] {
  const now = Date.now()
  const snapshots: CommunityBotSnapshot[] = []

  for (const bot of bots) {
    // Collect all tickers this bot has traded (from tradeHistory)
    const tickersSeen = new Set<Ticker>()
    for (const order of bot.portfolio.tradeHistory) {
      tickersSeen.add(order.ticker)
    }
    // Also include ticker from lastDecision if present
    if (bot.lastDecision) tickersSeen.add(bot.lastDecision.ticker)
    // If bot has never traded, skip — nothing meaningful to report
    if (tickersSeen.size === 0) continue

    for (const ticker of tickersSeen) {
      // Find the most recent trade for this ticker
      const tickerOrders = bot.portfolio.tradeHistory
        .filter((o) => o.ticker === ticker)
        .sort((a, b) => b.timestamp - a.timestamp)

      const lastOrder = tickerOrders[0] ?? bot.lastDecision
      if (!lastOrder) continue

      // Round pnlPct to nearest 0.5 for privacy
      const rawPnl = bot.portfolio.totalPnlPct
      const pnlPct = Math.round(rawPnl * 2) / 2

      snapshots.push({
        sessionId,
        botType: bot.config.type,
        ticker,
        lastAction: lastOrder.action,
        confidence: lastOrder.confidence,
        pnlPct,
        lastTradeTimestamp: lastOrder.timestamp,
        timestamp: now,
      })
    }
  }

  return snapshots
}

// ─── useHeartbeat ─────────────────────────────────────────────────────────────

/**
 * Publishes the user's local bot states to the community heartbeat endpoint.
 *
 * - Fires immediately on trade detection (lastDecision timestamp change)
 * - Fires every 10 s while sim is running
 * - Fires a final snapshot on sim stop / unmount
 *
 * No-ops when NEXT_PUBLIC_COMMUNITY_ENABLED is not "true".
 */
export function useHeartbeat(simState: SimState | null): void {
  const sessionIdRef = useRef<string | null>(null)
  const lastDecisionTimestampsRef = useRef<Record<string, number>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Only publish when community is enabled
  const enabled = process.env.NEXT_PUBLIC_COMMUNITY_ENABLED === "true"

  useEffect(() => {
    if (!enabled) return
    sessionIdRef.current = getOrCreateSessionId()
  }, [enabled])

  // Publish heartbeat
  const publish = (bots: BotState[]) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || !enabled) return
    const snapshots = buildSnapshots(sessionId, bots)
    if (snapshots.length === 0) return

    fetch("/api/community/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, snapshots }),
    }).catch(() => null) // fire-and-forget — failures are non-fatal
  }

  // Watch for new trades (compare lastDecision timestamps)
  useEffect(() => {
    if (!enabled || !simState) return

    let tradeDetected = false
    for (const bot of simState.bots) {
      const prev = lastDecisionTimestampsRef.current[bot.config.id]
      const curr = bot.lastDecision?.timestamp
      if (curr && curr !== prev) {
        lastDecisionTimestampsRef.current[bot.config.id] = curr
        tradeDetected = true
      }
    }

    if (tradeDetected) {
      publish(simState.bots)
    }
  }, [enabled, simState])

  // Periodic heartbeat every 10 s while running
  useEffect(() => {
    if (!enabled || !simState) return

    if (simState.status === "running") {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (simState) publish(simState.bots)
        }, 10_000)
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        // Final snapshot on stop
        publish(simState.bots)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, simState?.status])
}
