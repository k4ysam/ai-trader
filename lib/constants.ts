import type { BotConfig } from "@/types"

export const WATCHLIST: string[] = ["NVDA", "AAPL", "TSLA", "MSFT", "AMD"]

export const STARTING_BALANCE = 100_000

export const MAX_POSITION_PCT = 0.2 // max 20% of portfolio per stock

export const AI_BOT_CADENCE_MS = 14_400_000 // ms between AI decisions per ticker (~4 h, fits Gemini free tier 20 RPD)

export const PRICE_HISTORY_BARS = 50 // bars kept in memory per stock

export const MODEL_ID = "gemini-2.0-flash"

export const ALPACA_DATA_WS_URL =
  "wss://stream.data.alpaca.markets/v2/iex"

export const ALPACA_PAPER_BASE_URL = "https://paper-api.alpaca.markets"

export const ALPACA_DATA_BASE_URL = "https://data.alpaca.markets"

export const DEFAULT_BOTS: BotConfig[] = [
  {
    id: "rsi-bot",
    name: "RSI Ranger",
    type: "rsi",
    emoji: "📊",
    color: "#3b82f6",
    params: { period: 14, overbought: 70, oversold: 30 },
  },
  {
    id: "sma-bot",
    name: "Trend Rider",
    type: "sma-crossover",
    emoji: "📈",
    color: "#10b981",
    params: { fastPeriod: 10, slowPeriod: 30 },
  },
  {
    id: "momentum-bot",
    name: "Mo Mentum",
    type: "momentum",
    emoji: "🚀",
    color: "#f59e0b",
    params: { lookback: 20, threshold: 0.02 },
  },
  {
    id: "reversion-bot",
    name: "The Reverser",
    type: "mean-reversion",
    emoji: "🔄",
    color: "#ef4444",
    params: { period: 20, stdDevMultiplier: 2.0 },
  },
]
