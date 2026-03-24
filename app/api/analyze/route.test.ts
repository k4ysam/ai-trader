import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import type { AgentDecision, PriceEngineResult } from "@/types";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that reference the
// mocked modules so vi.mock factory closures capture the correct references.
// ---------------------------------------------------------------------------
const mockAnalyzeHeadline = vi.hoisted(() => vi.fn());
const mockCalculateNewPrice = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents", () => ({ analyzeHeadline: mockAnalyzeHeadline }));
vi.mock("@/lib/price-engine", () => ({ calculateNewPrice: mockCalculateNewPrice }));

// Import AFTER mocks are registered.
import { POST } from "@/app/api/analyze/route";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const stubDecisions: AgentDecision[] = [
  {
    traderName: "Marcus",
    archetype: "momentum",
    reasoning: ["Positive news", "Strong trend", "Buy the move"],
    action: "BUY",
    size: "aggressive",
    conviction: 9,
  },
  {
    traderName: "Vera",
    archetype: "contrarian",
    reasoning: ["Crowd is euphoric", "Fade the hype", "Sell into strength"],
    action: "SELL",
    size: "moderate",
    conviction: 7,
  },
  {
    traderName: "Dr. Reeves",
    archetype: "fundamental",
    reasoning: ["Earnings beat confirmed", "Margin expansion likely", "Hold core"],
    action: "HOLD",
    size: "small",
    conviction: 5,
  },
  {
    traderName: "Eddie",
    archetype: "panic",
    reasoning: ["Could be a trap", "Uncertainty remains", "Too risky"],
    action: "SELL",
    size: "small",
    conviction: 3,
  },
];

const stubPriceResult: PriceEngineResult = {
  newPrice: 900,
  oldPrice: 875,
  delta: 25,
  percentChange: 2.86,
  dominantAction: "BUY",
};

// ---------------------------------------------------------------------------
// Helper — constructs a Request cast to NextRequest, keeps tests concise.
// ---------------------------------------------------------------------------
function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-api-key-dummy");
    mockAnalyzeHeadline.mockReset();
    mockCalculateNewPrice.mockReset();
    // Default happy-path return values; individual tests override as needed.
    mockAnalyzeHeadline.mockResolvedValue({
      decisions: stubDecisions,
      partialFailure: false,
    });
    mockCalculateNewPrice.mockReturnValue(stubPriceResult);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // Group 1: Input validation — headline
  // -------------------------------------------------------------------------
  describe("Group 1: Input validation — headline", () => {
    it("1. returns 400 when headline field is missing", async () => {
      const res = await POST(makeRequest({ currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    it("2. returns 400 when headline is an empty string", async () => {
      const res = await POST(makeRequest({ headline: "", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    it("3. returns 400 when headline is a number, not a string", async () => {
      const res = await POST(makeRequest({ headline: 12345, currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("4. returns 400 when headline exceeds 500 characters", async () => {
      const longHeadline = "A".repeat(501);
      const res = await POST(makeRequest({ headline: longHeadline, currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("5. returns 200 when headline is exactly 500 characters (max-length boundary)", async () => {
      const maxHeadline = "A".repeat(500);
      const res = await POST(makeRequest({ headline: maxHeadline, currentPrice: 875 }));

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Group 2: Input validation — currentPrice
  // -------------------------------------------------------------------------
  describe("Group 2: Input validation — currentPrice", () => {
    it("6. returns 400 when currentPrice field is missing", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings" }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("7. returns 400 when currentPrice is 0", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 0 }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("8. returns 400 when currentPrice is negative", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: -50 }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("9. returns 400 when currentPrice is null (representing NaN / non-finite)", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: null }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("10. returns 400 when currentPrice is a string", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: "875" }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
    });

    it("11. returns 200 when currentPrice is a valid positive number (875)", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));

      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Group 3: Missing API key
  // -------------------------------------------------------------------------
  describe("Group 3: Missing API key", () => {
    it("12. returns 500 with correct message when ANTHROPIC_API_KEY is not set", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");

      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: "ANTHROPIC_API_KEY not configured" });
    });
  });

  // -------------------------------------------------------------------------
  // Group 4: Happy path
  // -------------------------------------------------------------------------
  describe("Group 4: Happy path", () => {
    it("13. returns 200 with correct AnalyzeResponse shape", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("decisions");
      expect(body).toHaveProperty("priceResult");
      expect(body).toHaveProperty("partialFailure");
    });

    it("14. passes decisions array from analyzeHeadline through to the response", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(body.decisions).toEqual(stubDecisions);
    });

    it("15. passes priceResult from calculateNewPrice through to the response", async () => {
      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(body.priceResult).toEqual(stubPriceResult);
    });

    it("16. passes partialFailure = true through when analyzeHeadline reports a partial failure", async () => {
      mockAnalyzeHeadline.mockResolvedValue({
        decisions: stubDecisions,
        partialFailure: true,
      });

      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.partialFailure).toBe(true);
    });

    it("17. passes partialFailure = false through when analyzeHeadline reports no failures", async () => {
      mockAnalyzeHeadline.mockResolvedValue({
        decisions: stubDecisions,
        partialFailure: false,
      });

      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.partialFailure).toBe(false);
    });

    it("18. calls analyzeHeadline with the correct headline and currentPrice arguments", async () => {
      await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));

      expect(mockAnalyzeHeadline).toHaveBeenCalledOnce();
      expect(mockAnalyzeHeadline).toHaveBeenCalledWith("NVDA beats earnings", 875);
    });

    it("19. calls calculateNewPrice with the correct currentPrice and decisions arguments", async () => {
      await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));

      expect(mockCalculateNewPrice).toHaveBeenCalledOnce();
      expect(mockCalculateNewPrice).toHaveBeenCalledWith(875, stubDecisions);
    });
  });

  // -------------------------------------------------------------------------
  // Group 5: Unexpected errors
  // -------------------------------------------------------------------------
  describe("Group 5: Unexpected errors", () => {
    it("20. returns 500 with generic message when analyzeHeadline throws — no stack trace", async () => {
      mockAnalyzeHeadline.mockRejectedValue(new Error("Anthropic SDK exploded"));

      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: "Internal server error" });
      // Ensure stack trace and internal details are NOT leaked.
      expect(JSON.stringify(body)).not.toContain("Anthropic SDK exploded");
      expect(JSON.stringify(body)).not.toContain("stack");
    });

    it("21. returns 500 with generic message when calculateNewPrice throws — no stack trace", async () => {
      mockCalculateNewPrice.mockImplementation(() => {
        throw new Error("Price engine failure");
      });

      const res = await POST(makeRequest({ headline: "NVDA beats earnings", currentPrice: 875 }));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: "Internal server error" });
      expect(JSON.stringify(body)).not.toContain("Price engine failure");
    });

    it("22. returns 400 (not 500) when the request body is malformed JSON", async () => {
      const req = new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ this is : not valid json }",
      }) as unknown as NextRequest;

      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });
  });
});
