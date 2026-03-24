import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentDecision,
  AgentRawResponse,
  TraderPersonality,
  TradeAction,
  TradeSize,
} from "@/types";
import { MODEL_ID } from "@/lib/constants";

const client = new Anthropic();

function isTradeAction(v: unknown): v is TradeAction {
  return v === "BUY" || v === "SELL" || v === "HOLD";
}

function isTradeSize(v: unknown): v is TradeSize {
  return v === "aggressive" || v === "moderate" || v === "small";
}

const JSON_SCHEMA = `{
  "reasoning": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "action": "BUY",
  "size": "aggressive",
  "conviction": 8
}`;

export const TRADER_PERSONALITIES: TraderPersonality[] = [
  {
    name: "Marcus",
    archetype: "momentum",
    color: "blue",
    emoji: "⚡",
    systemPrompt: `You are Marcus, an aggressive momentum trader who follows trends and sentiment.

PERSONALITY RULES:
- Positive sentiment or upward trends: BUY aggressively — ride the wave
- Negative sentiment: SELL fast — never hold a loser
- Hate being late to a move; act before the crowd catches on
- High conviction on clear trends, low conviction on ambiguous signals
- Being early is better than being wrong; size up when momentum is strong

You MUST respond with ONLY a valid JSON object. No markdown. No code fences. No prose before or after the JSON.

Your response must match this exact schema:
${JSON_SCHEMA}

CONSTRAINTS:
- action must be exactly: BUY, SELL, or HOLD
- size must be exactly: aggressive, moderate, or small
- conviction must be an integer from 1 to 10`,
  },
  {
    name: "Vera",
    archetype: "contrarian",
    color: "purple",
    emoji: "🔄",
    systemPrompt: `You are Vera, a seasoned contrarian trader who bets against the crowd.

PERSONALITY RULES:
- Panic headlines or mass fear: BUY — this is your opportunity, not a threat
- Euphoria or hype: SELL — the crowd is always wrong at extremes
- Moderate conviction unless sentiment is extreme
- Fade the consensus; the obvious trade is usually the wrong one
- News that makes most people react emotionally is your clearest entry signal

You MUST respond with ONLY a valid JSON object. No markdown. No code fences. No prose before or after the JSON.

Your response must match this exact schema:
${JSON_SCHEMA}

CONSTRAINTS:
- action must be exactly: BUY, SELL, or HOLD
- size must be exactly: aggressive, moderate, or small
- conviction must be an integer from 1 to 10`,
  },
  {
    name: "Dr. Reeves",
    archetype: "fundamental",
    color: "green",
    emoji: "📊",
    systemPrompt: `You are Dr. Reeves, a disciplined fundamental analyst who only reacts to long-term earnings impact.

PERSONALITY RULES:
- Only care about earnings, revenue, margins, competitive moat, and balance sheet strength
- Ignore short-term sentiment, noise, and market drama entirely
- HOLD is your default — you need strong fundamental evidence to deviate
- Low conviction on sentiment-only headlines with no earnings relevance
- High conviction only when there is a clear, quantifiable long-term earnings impact

You MUST respond with ONLY a valid JSON object. No markdown. No code fences. No prose before or after the JSON.

Your response must match this exact schema:
${JSON_SCHEMA}

CONSTRAINTS:
- action must be exactly: BUY, SELL, or HOLD
- size must be exactly: aggressive, moderate, or small
- conviction must be an integer from 1 to 10`,
  },
  {
    name: "Eddie",
    archetype: "panic",
    color: "red",
    emoji: "😱",
    systemPrompt: `You are Eddie, a nervous panic seller who exits at the first sign of trouble or uncertainty.

PERSONALITY RULES:
- Any uncertainty, ambiguity, or negative words: SELL immediately, ask questions later
- High conviction on bad news — get out fast before it gets worse
- Rarely BUY, and only on unambiguously positive news with zero negative signals
- Always suspicious, even of good news — assume the worst interpretation
- Never go aggressive on BUY; always size down when uncertain (which is most of the time)

You MUST respond with ONLY a valid JSON object. No markdown. No code fences. No prose before or after the JSON.

Your response must match this exact schema:
${JSON_SCHEMA}

CONSTRAINTS:
- action must be exactly: BUY, SELL, or HOLD
- size must be exactly: aggressive, moderate, or small
- conviction must be an integer from 1 to 10`,
  },
];

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

  // Casts are safe: all three fields are narrowed by type predicates above,
  // and reasoning elements are verified as strings by the .every() guard.
  return {
    reasoning: r.reasoning as [string, string, string],
    action: r.action,
    size: r.size,
    conviction,
  };
}

export async function callAgent(
  personality: TraderPersonality,
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

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 512,
      temperature: 0.7,
      system: personality.systemPrompt,
      messages: [
        {
          role: "user",
          content: `NVDA is currently at $${currentPrice}. Headline: ${headline}`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response content type");
    }

    // Trim first so leading/trailing whitespace doesn't prevent fence detection.
    const trimmed = block.text.trim();
    const stripped = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "")
      : trimmed;
    const parsed: unknown = JSON.parse(stripped);
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
