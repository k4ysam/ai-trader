import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TraderPersonality } from "@/types";

// ---------------------------------------------------------------------------
// vi.mock is hoisted above all imports by Vitest. Hoisted mocks must be
// declared via vi.hoisted() to avoid a temporal dead zone error.
//
// Gemini SDK call chain:
//   new GoogleGenerativeAI(key)
//     .getGenerativeModel({ model, systemInstruction, generationConfig })
//     .generateContent(prompt)
//   → { response: { text: () => string } }
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockGetGenerativeModel = vi.hoisted(() =>
  vi.fn().mockReturnValue({ generateContent: mockGenerateContent })
);

vi.mock("@google/generative-ai", () => ({
  // Must use a regular function (not arrow) so `new GoogleGenerativeAI()` works as a constructor.
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return { getGenerativeModel: mockGetGenerativeModel };
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

function mockGeminiResponse(text: string) {
  return { response: { text: () => text } };
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
    "You are Marcus. Respond in JSON with BUY, SELL, or HOLD. Always return valid JSON.",
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
    vi.stubEnv("GEMINI_API_KEY", "test-key-dummy");
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it("returns an AgentDecision with traderName from the personality", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.traderName).toBe("Marcus");
  });

  it("returns an AgentDecision with archetype from the personality", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.archetype).toBe("momentum");
  });

  it("returns a reasoning array with exactly 3 elements", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(Array.isArray(result.reasoning)).toBe(true);
    expect(result.reasoning).toHaveLength(3);
  });

  it("returns a valid action (BUY, SELL, or HOLD)", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ action: "SELL" })));
    const result = await callAgent(samplePersonality, "NVDA misses earnings", 500);
    expect(["BUY", "SELL", "HOLD"]).toContain(result.action);
  });

  it("returns a valid size (aggressive, moderate, or small)", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ size: "moderate" })));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(["aggressive", "moderate", "small"]).toContain(result.size);
  });

  it("returns conviction in range 1-10", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ conviction: 7 })));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.conviction).toBeGreaterThanOrEqual(1);
    expect(result.conviction).toBeLessThanOrEqual(10);
  });

  it("does not set an error field on success", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
  });

  it("strips markdown json fences (```json ... ```) before parsing", async () => {
    const fenced = "```json\n" + validAgentJson() + "\n```";
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(fenced));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
    expect(result.traderName).toBe("Marcus");
  });

  it("strips plain markdown fences (``` ... ```) before parsing", async () => {
    const fenced = "```\n" + validAgentJson() + "\n```";
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(fenced));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
    expect(result.traderName).toBe("Marcus");
  });

  it("extracts JSON from prose wrapper via regex when fences are absent", async () => {
    const prose = `Based on the headline, here is my analysis: ${validAgentJson()} Hope this helps!`;
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(prose));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
    expect(result.traderName).toBe("Marcus");
  });

  it("extracts JSON from response with leading/trailing prose lines", async () => {
    const prose = `Based on the headline,\n${validAgentJson()}\nLet me know if you need more.`;
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(prose));
    const result = await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(result.error).toBeUndefined();
    expect(result.action).toBe("BUY");
  });

  it("calls the SDK with model gemini-2.0-flash", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA beats earnings", 500);
    expect(mockGetGenerativeModel).toHaveBeenCalledOnce();
    const callArg = mockGetGenerativeModel.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.model).toBe("gemini-2.0-flash");
  });

  it("calls the SDK with temperature 0.7", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA beats earnings", 500);
    const callArg = mockGetGenerativeModel.mock.calls[0][0] as {
      generationConfig: { temperature: number };
    };
    expect(callArg.generationConfig.temperature).toBe(0.7);
  });

  it("calls the SDK with maxOutputTokens 512", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA beats earnings", 500);
    const callArg = mockGetGenerativeModel.mock.calls[0][0] as {
      generationConfig: { maxOutputTokens: number };
    };
    expect(callArg.generationConfig.maxOutputTokens).toBe(512);
  });

  it("includes the headline in the user message", async () => {
    const headline = "NVDA crushes Q4 earnings";
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    await callAgent(samplePersonality, headline, 500);
    const prompt = mockGenerateContent.mock.calls[0][0] as string;
    expect(prompt).toContain(headline);
  });

  it("includes the current price in the user message", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    await callAgent(samplePersonality, "NVDA crushes Q4 earnings", 875.5);
    const prompt = mockGenerateContent.mock.calls[0][0] as string;
    expect(prompt).toContain("875.5");
  });
});

// ---------------------------------------------------------------------------
// Group 3: callAgent — error handling
// ---------------------------------------------------------------------------

describe("callAgent — error handling", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-dummy");
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it("returns error field when action is invalid, does not throw", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ action: "PANIC" })));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when size is invalid, does not throw", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ size: "yolo" })));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when conviction is 0 (below range), does not throw", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ conviction: 0 })));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });

  it("returns error field when conviction is 11 (above range), does not throw", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ conviction: 11 })));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });

  it("returns error field when conviction is non-integer (5.5), does not throw", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson({ conviction: 5.5 })));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
  });

  it("returns error field on truly malformed JSON, does not throw", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse("this is not json at all"));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when SDK throws, does not throw", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API rate limit exceeded"));
    const result = await callAgent(samplePersonality, "Bad news", 500);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  it("returns error field when reasoning is not an array of 3, does not throw", async () => {
    mockGenerateContent.mockResolvedValue(
      mockGeminiResponse(validAgentJson({ reasoning: ["only one reason"] }))
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
    vi.stubEnv("GEMINI_API_KEY", "test-key-dummy");
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it("returns exactly 4 decisions", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const { decisions } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(decisions).toHaveLength(4);
  });

  it("sets partialFailure to false when all agents succeed", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const { partialFailure } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(partialFailure).toBe(false);
  });

  it("sets partialFailure to true when one agent fails", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(mockGeminiResponse(validAgentJson()))
      .mockResolvedValueOnce(mockGeminiResponse("not json"))
      .mockResolvedValueOnce(mockGeminiResponse(validAgentJson()))
      .mockResolvedValueOnce(mockGeminiResponse(validAgentJson()));

    const { partialFailure } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(partialFailure).toBe(true);
  });

  it("sets partialFailure to true when all agents fail", async () => {
    mockGenerateContent.mockRejectedValue(new Error("SDK down"));
    const { partialFailure } = await analyzeHeadline("NVDA beats earnings", 500);
    expect(partialFailure).toBe(true);
  });

  it("never throws even when all agents throw", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Total outage"));
    await expect(
      analyzeHeadline("NVDA beats earnings", 500)
    ).resolves.not.toThrow();
  });

  it("returns decisions containing all 4 trader names", async () => {
    mockGenerateContent.mockResolvedValue(mockGeminiResponse(validAgentJson()));
    const { decisions } = await analyzeHeadline("NVDA beats earnings", 500);
    const names = decisions.map((d) => d.traderName);
    expect(names).toContain("Marcus");
    expect(names).toContain("Vera");
    expect(names).toContain("Dr. Reeves");
    expect(names).toContain("Eddie");
  });
});
