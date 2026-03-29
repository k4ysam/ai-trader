import type { Strategy, StrategySignal } from "./types"
import type { PriceBar } from "@/types"

function stddev(values: number[], mean: number): number {
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export const meanReversionStrategy: Strategy = ({ bars, params }): StrategySignal => {
  const period = params.period ?? 20
  const multiplier = params.stdDevMultiplier ?? 2.0

  if (bars.length < period) {
    return {
      action: "HOLD",
      confidence: 0,
      reasoning: `Insufficient bars for mean reversion(${period}) — need ${period}, have ${bars.length}`,
    }
  }

  const window: PriceBar[] = bars.slice(-period)
  const closes = window.map((b) => b.close)
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length
  const sigma = stddev(closes, mean)

  const currentPrice = closes[closes.length - 1]

  if (sigma === 0) {
    return {
      action: "HOLD",
      confidence: 0,
      reasoning: "Zero volatility — no mean-reversion band to break",
    }
  }

  const upperBand = mean + multiplier * sigma
  const lowerBand = mean - multiplier * sigma
  const deviation = currentPrice - mean

  if (currentPrice < lowerBand) {
    const confidence = Math.min(1, Math.abs(deviation) / (multiplier * sigma))
    return {
      action: "BUY",
      confidence,
      reasoning: `Price $${currentPrice.toFixed(2)} below lower band $${lowerBand.toFixed(2)} (mean $${mean.toFixed(2)} - ${multiplier}σ) — buying reversal`,
    }
  }

  if (currentPrice > upperBand) {
    const confidence = Math.min(1, Math.abs(deviation) / (multiplier * sigma))
    return {
      action: "SELL",
      confidence,
      reasoning: `Price $${currentPrice.toFixed(2)} above upper band $${upperBand.toFixed(2)} (mean $${mean.toFixed(2)} + ${multiplier}σ) — selling reversal`,
    }
  }

  return {
    action: "HOLD",
    confidence: 0,
    reasoning: `Price $${currentPrice.toFixed(2)} within bands ($${lowerBand.toFixed(2)} – $${upperBand.toFixed(2)})`,
  }
}
