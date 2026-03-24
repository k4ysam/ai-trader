import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TraderPersonality } from "@/types";

// ---------------------------------------------------------------------------
// vi.mock is hoisted above all imports by Vitest, so `mockCreate` must also
// be hoisted via vi.hoisted() to avoid a temporal dead zone error.
// ---------------------------------------------------------------------------

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  // Must use a regular function (not arrow) so `new Anthropic()` works as a constructor.
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } };
  }),
}));

// Import the module under test AFTER the mock is registered.
import {
  TRADER_PERSONALITIES,
  callAgent,
  analyzeHeadline,
} from "@/lib/agents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAnthropicResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

function validAgentJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    reasoning: ["Step 1", "Step 2", "Step 3"],
    action: "BUY",
    size: "aggressive",
    conviction: 8,
    ...overrides,
  });
}

/** A minimal valid TraderPersonality for use in callAgent tests. */
const samplePersonality: TraderPersonality = {
  name: "Marcus",
  archetype: "momentum",
  color: "#ff0000",
  emoji: "🚀",
  systemPrompt:
    'You are Marcus. Respond in JSON with BUY, SELL, or HOLD. Always return valid JSON.',
};

// ---------------------------------------------------------------------------
// Group 1: TRADER_PERSONALITIES structure
// ---------------------------------------------------------------------------

describe("TRADER_PERSONALITIES structure", () => {
  it("has exactly 4 entries", () => {
    expect(TRADER_PERSONALITIES).toHaveLength(4);
  });

  it("all 4 entries have non-empty name, archetype, color, emoji, systemPrompt", () => {
    for (const p of TRADER_PERSONALITIES) {
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);

      expect(typeof p.archetype).toBe("string");
      expect(p.archetype.length).toBeGreaterThan(0);

      expect(typeof p.color).toBe("string");
      expect(p.color.length).toBeGreaterThan(0);

      expect(typeof p.emoji).toBe("string");
      expect(p.emoji.length).toBeGreaterThan(0);

      expect(typeof p.systemPrompt).toBe("string");
      expect(p.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  it("names are Marcus, Vera, Dr. Reeves, and Eddie", () => {
    const names = TRADER_PERSONALITIES.map((p) => p.name);
    expect(names).toContain("Marcus");
    expect(names).toContain("Vera");
    expect(names).toContain("Dr. Reeves");
    expect(names).toContain("Eddie");
  });

  it("archetypes are momentum, contrarian, fundamental, and panic", () => {
    const archetypes = TRADER_PERSONALITIES.map((p) => p.archetype);
    expect(archetypes).toContain("momentum");
    expect(archetypes).toContain("contrarian");
    expect(archetypes).toContain("fundamental");
    expect(archetypes).toContain("panic");
  });

  it("each systemPrompt contains the word JSON", () => {
    for (const p of TRADER_PERSONALITIES) {
      expect(p.systemPrompt).toContain("JSON");
    }
  });

  it("each systemPrompt contains BUY, SELL, and HOLD", () => {
    for (const p of TRADER_PERSONALITIES) {
      expect(p.systemPrompt).toContain("BUY");
      expect(p.systemPrompt).toContain("SELL");
      expect(p.systemPrompt).toContain("HOLD");
    }
  });
});

// ---------------------------------------------------------------------------
// Group 2: callAgent — happy path
// ---------------------------------------------------------------------------

describe("callAgent — happy path", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns an AgentDecision with traderName from the personality", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson())
    );
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.traderName).toBe("Marcus");
  });

  it("returns an AgentDecision with archetype from the personality", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson())
    );
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.archetype).toBe("momentum");
  });

  it("returns a reasoning array with exactly 3 elements", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson())
    );
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(Array.isArray(result.reasoning)).toBe(true);
    expect(result.reasoning).toHaveLength(3);
  });

  it("returns a valid action (BUY, SELL, or HOLD)", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ action: "SELL" }))
    );
    const result = await callAgent(samplePersonality, "NVDA misses earnings", 500);
    expect(["BUY", "SELL", "HOLD"]).toContain(result.action);
  });

  it("returns a valid size (aggressive, moderate, or small)", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ size: "moderate" }))
    );
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(["aggressive", "moderate", "small"]).toContain(result.size);
  });

  it("returns conviction in range 1-10", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ conviction: 7 }))
    );
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.conviction).toBeGreaterThanOrEqual(1);
    expect(result.conviction).toBeLessThanOrEqual(10);
  });

  it("does not set an error field on success", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson())
    );
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
  });

  it("strips markdown json fences (```json ... ```) before parsing", async () => {
    const fenced = "```json\n" + validAgentJson() + "\n```";
    mockCreate.mockResolvedValue(mockAnthropicResponse(fenced));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
    expect(result.traderName).toBe("Marcus");
  });

  it("strips plain markdown fences (``` ... ```) before parsing", async () => {
    const fenced = "```\n" + validAgentJson() + "\n```";
    mockCreate.mockResolvedValue(mockAnthropicResponse(fenced));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
    expect(result.traderName).toBe("Marcus");
  });

  it("calls the SDK with model claude-sonnet-4-5", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.model).toBe("claude-sonnet-4-5");
  });

  it("calls the SDK with temperature 0.7", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA beats earnings", 500);
    const callArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.temperature).toBe(0.7);
  });

  it("calls the SDK with max_tokens 512", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA beats earnings", 500);
    const callArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.max_tokens).toBe(512);
  });

  it("includes the headline in the user message", async () => {
    const headline = "NVDA crushes Q4 earnings";
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    await callAgent(samplePersonality, headline, 500);
    const callArg = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArg.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain(headline);
  });

  it("includes the current price in the user message", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA crushes Q4 earnings", 875.5);
    const callArg = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = callArg.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("875.5");
  });
});

// ---------------------------------------------------------------------------
// Group 3: callAgent — error handling
// ---------------------------------------------------------------------------

describe("callAgent — error handling", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns error field when action is invalid, does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ action: "PANIC" }))
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when size is invalid, does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ size: "yolo" }))
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when conviction is 0 (below range), does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ conviction: 0 }))
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });

  it("returns error field when conviction is 11 (above range), does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ conviction: 11 }))
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });

  it("returns error field when conviction is non-integer (5.5), does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(validAgentJson({ conviction: 5.5 }))
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });

  it("returns error field on malformed JSON, does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse("this is not json {{{")
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when SDK throws, does not throw", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when reasoning is not an array of 3, does not throw", async () => {
    mockCreate.mockResolvedValue(
      mockAnthropicResponse(
        validAgentJson({ reasoning: ["only one reason"] })
      )
    );
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Group 4: analyzeHeadline
// ---------------------------------------------------------------------------

describe("analyzeHeadline", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns exactly 4 decisions", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    const { decisions } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(decisions).toHaveLength(4);
  });

  it("sets partialFailure to false when all agents succeed", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    const { partialFailure } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(partialFailure).toBe(false);
  });

  it("sets partialFailure to true when one agent fails", async () => {
    // First call succeeds; second call returns invalid JSON so callAgent sets error.
    mockCreate
      .mockResolvedValueOnce(mockAnthropicResponse(validAgentJson()))
      .mockResolvedValueOnce(mockAnthropicResponse("not json"))
      .mockResolvedValueOnce(mockAnthropicResponse(validAgentJson()))
      .mockResolvedValueOnce(mockAnthropicResponse(validAgentJson()));

    const { partialFailure } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(partialFailure).toBe(true);
  });

  it("sets partialFailure to true when all agents fail", async () => {
    mockCreate.mockRejectedValue(new Error("SDK down"));
    const { partialFailure } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(partialFailure).toBe(true);
  });

  it("never throws even when all agents throw", async () => {
    mockCreate.mockRejectedValue(new Error("Total outage"));
    await expect(
      analyzeHeadline("NVDA beats earnings", 500)
    ).resolves.not.toThrow();
  });

  it("returns decisions containing all 4 trader names", async () => {
    mockCreate.mockResolvedValue(mockAnthropicResponse(validAgentJson()));
    const { decisions } = await analyzeHeadline("NVDA beats earnings", 500);
    const names = decisions.map((d) => d.traderName);
    expect(names).toContain("Marcus");
    expect(names).toContain("Vera");
    expect(names).toContain("Dr. Reeves");
    expect(names).toContain("Eddie");
  });
});
