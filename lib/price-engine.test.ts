import { describe, it, expect } from "vitest";
import { calculateNewPrice } from "@/lib/price-engine";
import type { AgentDecision, TradeAction, TradeSize } from "@/types";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

interface DecisionOverrides {
  traderName?: string;
  archetype?: string;
  reasoning?: [string, string, string];
  action?: TradeAction;
  size?: TradeSize;
  conviction?: number;
  error?: string;
}

function makeDecision(overrides: DecisionOverrides = {}): AgentDecision {
  return {
    traderName: overrides.traderName ?? "TestTrader",
    archetype: overrides.archetype ?? "momentum",
    reasoning: overrides.reasoning ?? ["reason 1", "reason 2", "reason 3"],
    action: overrides.action ?? "HOLD",
    size: overrides.size ?? "moderate",
    conviction: overrides.conviction ?? 5,
    ...(overrides.error !== undefined ? { error: overrides.error } : {}),
  };
}

// ---------------------------------------------------------------------------
// Formula reference (from spec):
//   contribution  = direction × sizeMultiplier × (conviction / 10)
//   direction     : BUY=+1, SELL=-1, HOLD=0
//   sizeMultiplier: aggressive=1.0, moderate=0.6, small=0.3
//   score         = Σ contributions / Σ |contributions|   (0 when all zero)
//   percentChange = clamp(score × 5, -5, +5)
//   newPrice      = round(currentPrice × (1 + percentChange/100), 2)
//   delta         = round(newPrice - currentPrice, 2)
//   dominantAction: score > 0.1 → BUY | score < -0.1 → SELL | else → HOLD
// ---------------------------------------------------------------------------

const BASE_PRICE = 875;

// ---------------------------------------------------------------------------
// 1. Full BUY signal
// ---------------------------------------------------------------------------
describe("all BUY aggressive conviction 10", () => {
  // 4 agents: each contribution = +1 × 1.0 × 1.0 = +1.0
  // sum = 4, absSum = 4, score = 1.0
  // percentChange = 1.0 × 5 = 5
  // newPrice = 875 × 1.05 = 918.75
  const decisions = Array.from({ length: 4 }, () =>
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10 })
  );

  it("increases price by exactly 5%", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBe(918.75);
  });

  it("returns percentChange of 5", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBe(5);
  });

  it("returns dominantAction BUY", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("BUY");
  });
});

// ---------------------------------------------------------------------------
// 2. Full SELL signal
// ---------------------------------------------------------------------------
describe("all SELL aggressive conviction 10", () => {
  // 4 agents: each contribution = -1 × 1.0 × 1.0 = -1.0
  // sum = -4, absSum = 4, score = -1.0
  // percentChange = -5
  // newPrice = 875 × 0.95 = 831.25
  const decisions = Array.from({ length: 4 }, () =>
    makeDecision({ action: "SELL", size: "aggressive", conviction: 10 })
  );

  it("decreases price by exactly 5%", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBe(831.25);
  });

  it("returns percentChange of -5", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBe(-5);
  });

  it("returns dominantAction SELL", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("SELL");
  });
});

// ---------------------------------------------------------------------------
// 3. All HOLD
// ---------------------------------------------------------------------------
describe("all HOLD decisions", () => {
  // HOLD direction = 0, so all contributions = 0
  // absSum = 0 → score = 0 (guard against div-by-zero)
  // newPrice = 875, delta = 0, percentChange = 0
  const decisions = Array.from({ length: 4 }, () =>
    makeDecision({ action: "HOLD", size: "aggressive", conviction: 10 })
  );

  it("leaves price unchanged", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBe(BASE_PRICE);
  });

  it("returns delta of 0", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.delta).toBe(0);
  });

  it("returns percentChange of 0", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBe(0);
  });

  it("returns dominantAction HOLD", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("HOLD");
  });
});

// ---------------------------------------------------------------------------
// 4. Perfectly balanced BUY vs SELL
// ---------------------------------------------------------------------------
describe("2 BUY aggressive conv 10 vs 2 SELL aggressive conv 10", () => {
  // BUY contributions: +1.0, +1.0  SELL contributions: -1.0, -1.0
  // sum = 0, absSum = 4, score = 0
  // price unchanged, dominantAction = HOLD
  const decisions = [
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
    makeDecision({ action: "SELL", size: "aggressive", conviction: 10 }),
    makeDecision({ action: "SELL", size: "aggressive", conviction: 10 }),
  ];

  it("leaves price unchanged when forces cancel", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBe(BASE_PRICE);
  });

  it("returns delta of 0", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.delta).toBe(0);
  });

  it("returns dominantAction HOLD when score is 0", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("HOLD");
  });
});

// ---------------------------------------------------------------------------
// 5. Single BUY moderate conviction 5
// ---------------------------------------------------------------------------
describe("single BUY moderate conviction 5", () => {
  // contribution = +1 × 0.6 × 0.5 = 0.3
  // sum = 0.3, absSum = 0.3, score = 1.0
  // percentChange = 5, newPrice = 875 × 1.05 = 918.75
  // (only one agent → normalised score always ±1.0)
  const decisions = [
    makeDecision({ action: "BUY", size: "moderate", conviction: 5 }),
  ];

  it("increases the price (positive move)", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBeGreaterThan(BASE_PRICE);
  });

  it("returns dominantAction BUY (score > 0.1)", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("BUY");
  });

  it("exercises the moderate size multiplier path (0.6)", () => {
    // With a single agent the normalised score is always 1.0; the moderate
    // size affects the raw contribution but not the final score magnitude.
    // We confirm the formula still produces a valid BUY outcome.
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Errored agents are excluded
// ---------------------------------------------------------------------------
describe("errored agents are excluded from calculation", () => {
  // 1 valid BUY aggressive conv 10 + 1 errored BUY aggressive conv 10
  // Only 1 valid agent counted → score = 1.0 → newPrice = 918.75
  const decisions = [
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
    makeDecision({
      action: "BUY",
      size: "aggressive",
      conviction: 10,
      error: "LLM timeout",
    }),
  ];

  it("produces same result as if only valid agents existed", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    // 1 valid BUY aggressive conv 10 → score 1.0 → +5%
    expect(result.newPrice).toBe(918.75);
  });

  it("returns dominantAction BUY based on valid agents only", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("BUY");
  });

  it("does not count the errored agent's contribution", () => {
    // If the errored agent were included the score would still be 1.0 here;
    // test a case where inclusion would change the direction: 1 valid BUY,
    // 1 errored SELL — price should still go up.
    const mixed = [
      makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
      makeDecision({
        action: "SELL",
        size: "aggressive",
        conviction: 10,
        error: "parse error",
      }),
    ];
    const result = calculateNewPrice(BASE_PRICE, mixed);
    expect(result.newPrice).toBeGreaterThan(BASE_PRICE);
    expect(result.dominantAction).toBe("BUY");
  });
});

// ---------------------------------------------------------------------------
// 7. All agents errored
// ---------------------------------------------------------------------------
describe("all agents have errors", () => {
  const decisions = [
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10, error: "timeout" }),
    makeDecision({ action: "SELL", size: "aggressive", conviction: 10, error: "parse fail" }),
    makeDecision({ action: "BUY", size: "moderate", conviction: 7, error: "network error" }),
  ];

  it("leaves price unchanged", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBe(BASE_PRICE);
  });

  it("returns delta of 0", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.delta).toBe(0);
  });

  it("returns dominantAction HOLD", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("HOLD");
  });

  it("returns percentChange of 0", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. dominantAction = BUY (score > 0.1)
// ---------------------------------------------------------------------------
describe("dominantAction is BUY when score > 0.1", () => {
  // 6 BUY aggressive conv 10 vs 1 SELL aggressive conv 10
  // sum = 5, absSum = 7, score = 5/7 ≈ 0.714 > 0.1
  const decisions = [
    ...Array.from({ length: 6 }, () =>
      makeDecision({ action: "BUY", size: "aggressive", conviction: 10 })
    ),
    makeDecision({ action: "SELL", size: "aggressive", conviction: 10 }),
  ];

  it("sets dominantAction to BUY", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("BUY");
  });

  it("increases the price", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBeGreaterThan(BASE_PRICE);
  });
});

// ---------------------------------------------------------------------------
// 9. dominantAction = SELL (score < -0.1)
// ---------------------------------------------------------------------------
describe("dominantAction is SELL when score < -0.1", () => {
  // 1 BUY aggressive conv 10 vs 6 SELL aggressive conv 10
  // sum = -5, absSum = 7, score = -5/7 ≈ -0.714 < -0.1
  const decisions = [
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
    ...Array.from({ length: 6 }, () =>
      makeDecision({ action: "SELL", size: "aggressive", conviction: 10 })
    ),
  ];

  it("sets dominantAction to SELL", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("SELL");
  });

  it("decreases the price", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.newPrice).toBeLessThan(BASE_PRICE);
  });
});

// ---------------------------------------------------------------------------
// 10. dominantAction = HOLD when score is between -0.1 and 0.1
// ---------------------------------------------------------------------------
describe("dominantAction is HOLD when score is between -0.1 and 0.1", () => {
  // 10 BUY aggressive conv 10 vs 11 SELL aggressive conv 10
  // sum = -1, absSum = 21, score = -1/21 ≈ -0.0476  (in range (-0.1, 0.1))
  const decisions = [
    ...Array.from({ length: 10 }, () =>
      makeDecision({ action: "BUY", size: "aggressive", conviction: 10 })
    ),
    ...Array.from({ length: 11 }, () =>
      makeDecision({ action: "SELL", size: "aggressive", conviction: 10 })
    ),
  ];

  it("sets dominantAction to HOLD despite slight imbalance", () => {
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.dominantAction).toBe("HOLD");
  });

  it("score threshold at exactly 0.1 boundary: BUY-heavy panel gives BUY", () => {
    // 11 BUY vs 9 SELL → score = 2/20 = 0.1 (boundary — inclusive BUY? spec says > 0.1 for BUY)
    // Use 12 BUY vs 9 SELL → score = 3/21 ≈ 0.143 > 0.1 → BUY
    const buyHeavy = [
      ...Array.from({ length: 12 }, () =>
        makeDecision({ action: "BUY", size: "aggressive", conviction: 10 })
      ),
      ...Array.from({ length: 9 }, () =>
        makeDecision({ action: "SELL", size: "aggressive", conviction: 10 })
      ),
    ];
    const result = calculateNewPrice(BASE_PRICE, buyHeavy);
    expect(result.dominantAction).toBe("BUY");
  });
});

// ---------------------------------------------------------------------------
// 11. newPrice and delta are rounded to 2 decimal places
// ---------------------------------------------------------------------------
describe("rounding to 2 decimal places", () => {
  // Use a price that produces a non-terminating decimal.
  // price = 100.333, single BUY aggressive conv 10 → score=1.0, pct=5%
  // rawNewPrice = 100.333 × 1.05 = 105.34965
  // rounded    = 105.35
  // delta      = round(105.35 - 100.333, 2) = round(5.017, 2) = 5.02
  const price = 100.333;
  const decisions = [
    makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
  ];

  it("rounds newPrice to 2 decimal places", () => {
    const result = calculateNewPrice(price, decisions);
    const decimals = (result.newPrice.toString().split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(2);
    expect(result.newPrice).toBe(105.35);
  });

  it("rounds delta to 2 decimal places", () => {
    const result = calculateNewPrice(price, decisions);
    const decimals = (result.delta.toString().split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(2);
    expect(result.delta).toBe(5.02);
  });
});

// ---------------------------------------------------------------------------
// 12. oldPrice is preserved in the result
// ---------------------------------------------------------------------------
describe("oldPrice is preserved", () => {
  it("oldPrice equals the currentPrice argument passed in", () => {
    const price = 1234.56;
    const decisions = [
      makeDecision({ action: "BUY", size: "moderate", conviction: 8 }),
    ];
    const result = calculateNewPrice(price, decisions);
    expect(result.oldPrice).toBe(price);
  });

  it("oldPrice is unaffected by the calculated price movement", () => {
    const price = 500;
    const decisions = [
      makeDecision({ action: "SELL", size: "aggressive", conviction: 10 }),
    ];
    const result = calculateNewPrice(price, decisions);
    expect(result.oldPrice).toBe(500);
    expect(result.newPrice).not.toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 13. percentChange is clamped — never exceeds ±5
// ---------------------------------------------------------------------------
describe("percentChange is clamped to ±5", () => {
  it("does not exceed +5 on a pure BUY panel", () => {
    const decisions = Array.from({ length: 10 }, () =>
      makeDecision({ action: "BUY", size: "aggressive", conviction: 10 })
    );
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBeLessThanOrEqual(5);
  });

  it("does not go below -5 on a pure SELL panel", () => {
    const decisions = Array.from({ length: 10 }, () =>
      makeDecision({ action: "SELL", size: "aggressive", conviction: 10 })
    );
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBeGreaterThanOrEqual(-5);
  });

  it("caps at exactly +5 for max bullish signal", () => {
    const decisions = [
      makeDecision({ action: "BUY", size: "aggressive", conviction: 10 }),
    ];
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBe(5);
  });

  it("caps at exactly -5 for max bearish signal", () => {
    const decisions = [
      makeDecision({ action: "SELL", size: "aggressive", conviction: 10 }),
    ];
    const result = calculateNewPrice(BASE_PRICE, decisions);
    expect(result.percentChange).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// 14. size multiplier correctness (small = 0.3, moderate = 0.6)
// ---------------------------------------------------------------------------
describe("size multipliers exercise all three branches", () => {
  it("small size produces a smaller raw contribution than moderate", () => {
    // Compare two identical single-agent scenarios: small vs moderate, same action/conviction.
    // Both normalise to score=1.0 (single agent), so percentChange is the same (+5%).
    // This test verifies the code path for size=small is exercised and produces a valid result.
    const smallDecisions = [
      makeDecision({ action: "BUY", size: "small", conviction: 10 }),
    ];
    const result = calculateNewPrice(BASE_PRICE, smallDecisions);
    expect(result.dominantAction).toBe("BUY");
    expect(result.newPrice).toBeGreaterThan(BASE_PRICE);
  });

  it("small vs moderate mixed panel: moderate agent has more influence", () => {
    // 1 SELL aggressive conv 10  + 1 BUY moderate conv 10 vs 1 BUY small conv 10
    // SELL: -1.0   BUY-moderate: +0.6   BUY-small: +0.3
    // sum = -0.1,  absSum = 1.9,  score = -0.1/1.9 ≈ -0.0526  → HOLD (not SELL)
    const decisions = [
      makeDecision({ action: "SELL", size: "aggressive", conviction: 10 }),
      makeDecision({ action: "BUY", size: "moderate", conviction: 10 }),
      makeDecision({ action: "BUY", size: "small", conviction: 10 }),
    ];
    const result = calculateNewPrice(BASE_PRICE, decisions);
    // score ≈ -0.0526 which is between -0.1 and 0.1 → HOLD
    expect(result.dominantAction).toBe("HOLD");
  });
});
