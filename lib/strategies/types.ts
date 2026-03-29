import type { PriceBar, Portfolio, Ticker, TradeAction } from "@/types"

export interface StrategyInput {
  ticker: Ticker
  bars: PriceBar[] // historical bars, oldest first
  currentPrice: number
  portfolio: Portfolio
  params: Record<string, number>
}

export interface StrategySignal {
  action: TradeAction
  confidence: number // 0–1
  reasoning: string
}

export type Strategy = (input: StrategyInput) => StrategySignal
