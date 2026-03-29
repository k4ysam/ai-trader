import type { Strategy, StrategySignal } from "./types"

export const momentumStrategy: Strategy = ({ bars, params }): StrategySignal => {
  const lookback = params.lookback ?? 20
  const threshold = params.threshold ?? 0.02

  if (bars.length < lookback + 1) {
    return {
      action: "HOLD",
      confidence: 0,
      reasoning: `Insufficient bars for momentum(${lookback}) — need ${lookback + 1}, have ${bars.length}`,
    }
  }

  const pastClose = bars[bars.length - 1 - lookback].close
  const currentClose = bars[bars.length - 1].close
  const pctChange = (currentClose - pastClose) / pastClose

  if (pctChange > threshold) {
    const confidence = Math.min(1, pctChange / (threshold * 5))
    return {
      action: "BUY",
      confidence,
      reasoning: `Price up ${(pctChange * 100).toFixed(2)}% over ${lookback} bars — positive momentum`,
    }
  }

  if (pctChange < -threshold) {
    const confidence = Math.min(1, Math.abs(pctChange) / (threshold * 5))
    return {
      action: "SELL",
      confidence,
      reasoning: `Price down ${(Math.abs(pctChange) * 100).toFixed(2)}% over ${lookback} bars — negative momentum`,
    }
  }

  return {
    action: "HOLD",
    confidence: 0,
    reasoning: `Price change ${(pctChange * 100).toFixed(2)}% is within threshold (±${(threshold * 100).toFixed(1)}%)`,
  }
}
