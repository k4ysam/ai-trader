import type { AgentDecision, PriceEngineResult, TradeAction, TradeSize } from "@/types";
import { MAX_PRICE_CHANGE_PERCENT } from "@/lib/constants";

const ACTION_DIRECTION: Record<TradeAction, number> = {
  BUY: 1,
  SELL: -1,
  HOLD: 0,
};

const SIZE_MULTIPLIER: Record<TradeSize, number> = {
  aggressive: 1.0,
  moderate: 0.6,
  small: 0.3,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateNewPrice(
  currentPrice: number,
  decisions: AgentDecision[]
): PriceEngineResult {
  if (currentPrice <= 0 || !Number.isFinite(currentPrice)) {
    throw new Error(`Invalid currentPrice: ${currentPrice}`);
  }

  const valid = decisions.filter((d) => d.error == null);

  if (valid.length === 0) {
    return {
      newPrice: currentPrice,
      oldPrice: currentPrice,
      delta: 0,
      percentChange: 0,
      dominantAction: "HOLD",
    };
  }

  const { weightedSum, absSum } = valid.reduce(
    (acc, d) => {
      const clampedConviction = Math.max(1, Math.min(10, d.conviction));
      const contribution =
        ACTION_DIRECTION[d.action] * SIZE_MULTIPLIER[d.size] * (clampedConviction / 10);
      return {
        weightedSum: acc.weightedSum + contribution,
        absSum: acc.absSum + Math.abs(contribution),
      };
    },
    { weightedSum: 0, absSum: 0 }
  );

  const score = absSum > 0 ? weightedSum / absSum : 0;
  const percentChange = Math.max(
    -MAX_PRICE_CHANGE_PERCENT,
    Math.min(MAX_PRICE_CHANGE_PERCENT, score * MAX_PRICE_CHANGE_PERCENT)
  );

  // newPrice and delta are derived from the rounded percentChange.
  // Note: delta / oldPrice * 100 may not exactly equal percentChange due to
  // double-rounding — consumers should read percentChange directly from this result.
  const newPrice = round2(currentPrice * (1 + percentChange / 100));
  const delta = round2(newPrice - currentPrice);

  let dominantAction: TradeAction = "HOLD";
  if (score > 0.1) dominantAction = "BUY";
  else if (score < -0.1) dominantAction = "SELL";

  return {
    newPrice,
    oldPrice: currentPrice,
    delta,
    percentChange: round2(percentChange),
    dominantAction,
  };
}
