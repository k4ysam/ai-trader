import type { Strategy, StrategySignal } from "./types"
import type { PriceBar } from "@/types"

function calculateRSI(bars: PriceBar[], period: number): number {
  if (bars.length < period + 1) return 50 // neutral when insufficient data

  const changes = bars.slice(-period - 1).map((bar, i, arr) => {
    if (i === 0) return 0
    return bar.close - arr[i - 1].close
  }).slice(1)

  const gains = changes.map((c) => (c > 0 ? c : 0))
  const losses = changes.map((c) => (c < 0 ? -c : 0))

  const avgGain = gains.reduce((a, b) => a + b, 0) / period
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period

  if (avgLoss === 0 && avgGain === 0) return 50 // no movement — truly neutral
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export const rsiStrategy: Strategy = ({ bars, params }): StrategySignal => {
  const period = params.period ?? 14
  const overbought = params.overbought ?? 70
  const oversold = params.oversold ?? 30

  if (bars.length < period + 1) {
    return { action: "HOLD", confidence: 0, reasoning: "Insufficient bars for RSI calculation" }
  }

  const rsi = calculateRSI(bars, period)

  if (rsi < oversold) {
    const confidence = Math.min(1, (oversold - rsi) / oversold)
    return {
      action: "BUY",
      confidence,
      reasoning: `RSI=${rsi.toFixed(1)} is below oversold threshold (${oversold}) — buying dip`,
    }
  }

  if (rsi > overbought) {
    const confidence = Math.min(1, (rsi - overbought) / (100 - overbought))
    return {
      action: "SELL",
      confidence,
      reasoning: `RSI=${rsi.toFixed(1)} is above overbought threshold (${overbought}) — trimming position`,
    }
  }

  const distFromMid = Math.abs(rsi - 50)
  const confidence = Math.min(1, distFromMid / 50)
  return {
    action: "HOLD",
    confidence,
    reasoning: `RSI=${rsi.toFixed(1)} is in neutral zone (${oversold}–${overbought})`,
  }
}
