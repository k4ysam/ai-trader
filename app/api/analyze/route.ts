import type { NextRequest } from "next/server";
import type { AnalyzeResponse } from "@/types";
import { analyzeHeadline } from "@/lib/agents";
import { calculateNewPrice } from "@/lib/price-engine";
import { checkRateLimit } from "@/lib/rate-limit";

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function serverError(message: string): Response {
  return Response.json({ error: message }, { status: 500 });
}

export async function POST(req: NextRequest): Promise<Response> {
  // Rate limiting — 20 req/min per IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  // Guard API key — generic message to avoid leaking infrastructure details.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return serverError("Service not configured");
  }

  // Parse body — malformed JSON is a client error.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("Request body must be a JSON object");
  }

  const { headline, currentPrice } = body as Record<string, unknown>;

  // Validate headline.
  if (typeof headline !== "string" || headline.trim().length === 0) {
    return badRequest("headline must be a non-empty string");
  }
  if (headline.length > 500) {
    return badRequest("headline must be at most 500 characters");
  }

  // Validate currentPrice.
  if (typeof currentPrice !== "number" || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return badRequest("currentPrice must be a finite positive number");
  }

  // Orchestrate agents and price engine.
  try {
    const { decisions, partialFailure } = await analyzeHeadline(headline, currentPrice);
    const priceResult = calculateNewPrice(currentPrice, decisions);

    const responseBody: AnalyzeResponse = { decisions, priceResult, partialFailure };
    return Response.json(responseBody, { status: 200 });
  } catch {
    return serverError("Internal server error");
  }
}
