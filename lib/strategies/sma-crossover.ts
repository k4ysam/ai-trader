import type { Strategy, StrategySignal } from "./types"
import type { PriceBar } from "@/types"

function sma(bars: PriceBar[], period: number): number {
  const slice = bars.slice(-period)
  return slice.reduce((sum, b) => sum + b.close, 0) / slice.length
}

export const smaCrossoverStrategy: Strategy = ({ bars, params }): StrategySignal => {
  const fastPeriod = params.fastPeriod ?? 10
  const slowPeriod = params.slowPeriod ?? 30

  if (bars.length < slowPeriod) {
    return {
      action: "HOLD",
      confidence: 0,
      reasoning: `Insufficient bars for SMA(${slowPeriod}) — need ${slowPeriod}, have ${bars.length}`,
    }
  }

  const fastSMA = sma(bars, fastPeriod)
  const slowSMA = sma(bars, slowPeriod)

  if (fastSMA === slowSMA) {
    return { action: "HOLD", confidence: 0, reasoning: "Fast and slow SMAs are equal — no signal" }
  }

  const spread = (fastSMA - slowSMA) / slowSMA // positive = bullish, negative = bearish
  const confidence = Math.min(1, Math.abs(spread) * 10) // 10x multiplier to amplify small spreads

  if (spread > 0) {
    return {
      action: "BUY",
      confidence,
      reasoning: `SMA(${fastPeriod})=$${fastSMA.toFixed(2)} > SMA(${slowPeriod})=$${slowSMA.toFixed(2)} — bullish crossover`,
    }
  }

  return {
    action: "SELL",
    confidence,
    reasoning: `SMA(${fastPeriod})=$${fastSMA.toFixed(2)} < SMA(${slowPeriod})=$${slowSMA.toFixed(2)} — bearish crossover`,
  }
}
