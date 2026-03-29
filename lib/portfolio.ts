import { STARTING_BALANCE, MAX_POSITION_PCT } from "@/lib/constants"
import type { Portfolio, Position, Order, TradeAction, Ticker } from "@/types"

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createPortfolio(botId: string): Portfolio {
  return {
    botId,
    cash: STARTING_BALANCE,
    positions: {},
    totalValue: STARTING_BALANCE,
    totalPnl: 0,
    totalPnlPct: 0,
    tradeHistory: [],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTotals(
  cash: number,
  positions: Record<Ticker, Position>
): Pick<Portfolio, "totalValue" | "totalPnl" | "totalPnlPct"> {
  const invested = Object.values(positions).reduce(
    (sum, pos) => sum + pos.marketValue,
    0
  )
  const totalValue = cash + invested
  const totalPnl = totalValue - STARTING_BALANCE
  const totalPnlPct = (totalPnl / STARTING_BALANCE) * 100
  return { totalValue, totalPnl, totalPnlPct }
}

// ─── executeOrder ─────────────────────────────────────────────────────────────

export function executeOrder(portfolio: Portfolio, order: Order): Portfolio {
  if (order.action === "HOLD") return portfolio

  if (order.action === "BUY") {
    const cost = order.qty * order.price
    if (cost > portfolio.cash) return portfolio // insufficient cash — reject silently

    const existing = portfolio.positions[order.ticker]
    let newPosition: Position

    if (existing) {
      const totalQty = existing.qty + order.qty
      const avgCost = (existing.avgCost * existing.qty + order.price * order.qty) / totalQty
      const marketValue = totalQty * order.price
      const unrealizedPnl = (order.price - avgCost) * totalQty
      const unrealizedPnlPct = avgCost !== 0 ? (unrealizedPnl / (avgCost * totalQty)) * 100 : 0

      newPosition = {
        ticker: order.ticker,
        qty: totalQty,
        avgCost,
        currentPrice: order.price,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPct,
      }
    } else {
      newPosition = {
        ticker: order.ticker,
        qty: order.qty,
        avgCost: order.price,
        currentPrice: order.price,
        marketValue: order.qty * order.price,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
      }
    }

    const newCash = portfolio.cash - cost
    const newPositions = { ...portfolio.positions, [order.ticker]: newPosition }
    const totals = computeTotals(newCash, newPositions)

    return {
      ...portfolio,
      cash: newCash,
      positions: newPositions,
      tradeHistory: [...portfolio.tradeHistory, order],
      ...totals,
    }
  }

  // SELL
  const existing = portfolio.positions[order.ticker]
  if (!existing || order.qty > existing.qty) return portfolio // nothing to sell

  const proceeds = order.qty * order.price
  const newCash = portfolio.cash + proceeds
  const remainingQty = existing.qty - order.qty

  const newPositions = { ...portfolio.positions }
  if (remainingQty === 0) {
    delete newPositions[order.ticker]
  } else {
    const marketValue = remainingQty * order.price
    const unrealizedPnl = (order.price - existing.avgCost) * remainingQty
    const unrealizedPnlPct =
      existing.avgCost !== 0
        ? (unrealizedPnl / (existing.avgCost * remainingQty)) * 100
        : 0
    newPositions[order.ticker] = {
      ...existing,
      qty: remainingQty,
      currentPrice: order.price,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
    }
  }

  const totals = computeTotals(newCash, newPositions)

  return {
    ...portfolio,
    cash: newCash,
    positions: newPositions,
    tradeHistory: [...portfolio.tradeHistory, order],
    ...totals,
  }
}

// ─── updatePrices ─────────────────────────────────────────────────────────────

export function updatePrices(
  portfolio: Portfolio,
  prices: Record<Ticker, number>
): Portfolio {
  const newPositions: Record<Ticker, Position> = {}

  for (const [ticker, pos] of Object.entries(portfolio.positions)) {
    const price = prices[ticker]
    if (price === undefined) {
      newPositions[ticker] = pos
      continue
    }
    const marketValue = pos.qty * price
    const unrealizedPnl = (price - pos.avgCost) * pos.qty
    const unrealizedPnlPct =
      pos.avgCost !== 0 ? (unrealizedPnl / (pos.avgCost * pos.qty)) * 100 : 0

    newPositions[ticker] = {
      ...pos,
      currentPrice: price,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
    }
  }

  const totals = computeTotals(portfolio.cash, newPositions)

  return {
    ...portfolio,
    positions: newPositions,
    ...totals,
  }
}

// ─── calculateOrderQty ────────────────────────────────────────────────────────

export function calculateOrderQty(
  portfolio: Portfolio,
  ticker: Ticker,
  action: TradeAction,
  price: number,
  sizePct: number
): number {
  if (action === "HOLD") return 0

  if (action === "SELL") {
    return portfolio.positions[ticker]?.qty ?? 0
  }

  // BUY
  if (price <= 0) return 0
  const cappedPct = Math.min(sizePct, MAX_POSITION_PCT)
  const budget = portfolio.cash * cappedPct
  return Math.floor(budget / price)
}
