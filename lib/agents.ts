import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AgentDecision,
  AgentRawResponse,
  TradeAction,
  TradeSize,
} from "@/types";
import { MODEL_ID } from "@/lib/constants";
import { TRADER_PERSONALITIES } from "@/lib/personalities";

export { TRADER_PERSONALITIES };

function isTradeAction(v: unknown): v is TradeAction {
  return v === "BUY" || v === "SELL" || v === "HOLD";
}

function isTradeSize(v: unknown): v is TradeSize {
  return v === "aggressive" || v === "moderate" || v === "small";
}

function validateRawResponse(raw: unknown): AgentRawResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Response is not an object");
  }

  const r = raw as Record<string, unknown>;

  if (
    !Array.isArray(r.reasoning) ||
    r.reasoning.length !== 3 ||
    !r.reasoning.every((s) => typeof s === "string")
  ) {
    throw new Error("reasoning must be an array of exactly 3 strings");
  }

  if (!isTradeAction(r.action)) {
    throw new Error(`Invalid action: ${String(r.action)}`);
  }

  if (!isTradeSize(r.size)) {
    throw new Error(`Invalid size: ${String(r.size)}`);
  }

  const conviction = r.conviction;
  if (
    typeof conviction !== "number" ||
    !Number.isInteger(conviction) ||
    conviction < 1 ||
    conviction > 10
  ) {
    throw new Error(`Invalid conviction: ${String(conviction)}`);
  }

  return {
    reasoning: r.reasoning as [string, string, string],
    action: r.action,
    size: r.size,
    conviction,
  };
}

export async function callAgent(
  personality: (typeof TRADER_PERSONALITIES)[number],
  headline: string,
  currentPrice: number
): Promise<AgentDecision> {
  try {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new Error(`Invalid currentPrice: ${currentPrice}`);
    }
    if (headline.length > 500) {
      throw new Error("headline must be at most 500 characters");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: personality.systemPrompt,
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    });

    const userMessage = `NVDA is currently at $${currentPrice}. Headline: ${headline}`;
    const result = await model.generateContent(userMessage);
    const text = result.response.text();

    // Trim first so leading/trailing whitespace doesn't prevent fence detection.
    const trimmed = text.trim();
    const stripped = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "")
      : trimmed;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Retry: extract first {...} from the raw text via regex.
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found in response");
      parsed = JSON.parse(match[0]);
    }

    const validated = validateRawResponse(parsed);

    return {
      traderName: personality.name,
      archetype: personality.archetype,
      ...validated,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return {
      traderName: personality.name,
      archetype: personality.archetype,
      reasoning: ["Error", "Error", "Error"],
      action: "HOLD",
      size: "small",
      conviction: 1,
      error: msg,
    };
  }
}

export async function analyzeHeadline(
  headline: string,
  currentPrice: number
): Promise<{ decisions: AgentDecision[]; partialFailure: boolean }> {
  const results = await Promise.allSettled(
    TRADER_PERSONALITIES.map((p) => callAgent(p, headline, currentPrice))
  );

  const decisions: AgentDecision[] = results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const personality = TRADER_PERSONALITIES[i];
    const msg =
      result.reason instanceof Error ? result.reason.message : "Unknown error";
    return {
      traderName: personality.name,
      archetype: personality.archetype,
      reasoning: ["Error", "Error", "Error"],
      action: "HOLD",
      size: "small",
      conviction: 1,
      error: msg,
    };
  });

  const partialFailure = decisions.some((d) => d.error != null);

  return { decisions, partialFailure };
}
