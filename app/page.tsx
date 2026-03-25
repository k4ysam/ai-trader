"use client";

import { useState, useEffect, useRef } from "react";
import { STARTING_PRICE, STOCK_TICKER } from "@/lib/constants";
import type { AgentDecision, AnalyzeResponse, PriceEvent } from "@/types";
import HeadlineInput from "@/components/HeadlineInput";
import AgentPanel from "@/components/AgentPanel";
import PriceTicker from "@/components/PriceTicker";
import PriceChart from "@/components/PriceChart";
import DecisionLog from "@/components/DecisionLog";

const COOLDOWN_MS = 2000;

export default function Home() {
  const [currentPrice, setCurrentPrice] = useState(STARTING_PRICE);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([
    { time: "Start", price: STARTING_PRICE },
  ]);
  const [events, setEvents] = useState<PriceEvent[]>([]);
  const [latestDecisions, setLatestDecisions] = useState<AgentDecision[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  async function handleSubmit(headline: string) {
    if (isLoading || isCooldown) return;
    setIsLoading(true);
    setError(null);
    setPartialFailure(false);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, currentPrice }),
      });

      if (!res.ok) {
        setError(`Request failed (${res.status}). Please try again.`);
        return;
      }

      const raw: unknown = await res.json();
      if (
        typeof raw !== "object" ||
        raw === null ||
        !Array.isArray((raw as Record<string, unknown>).decisions) ||
        typeof (raw as Record<string, unknown>).priceResult !== "object"
      ) {
        setError("Unexpected response shape from server");
        return;
      }
      const data = raw as AnalyzeResponse;
      const { decisions, priceResult } = data;

      const newPrice = priceResult.newPrice;
      const timeLabel = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const event: PriceEvent = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        headline,
        decisions,
        priceResult,
      };

      setPreviousPrice(currentPrice);
      setCurrentPrice(newPrice);
      setPriceHistory((prev) => [...prev, { time: timeLabel, price: newPrice }]);
      setEvents((prev) => [...prev, event]);
      // If every agent hit a rate limit, surface a clear message instead of 4 error cards.
      const allRateLimited = decisions.every((d) =>
        d.error?.includes("Rate limit")
      );
      if (allRateLimited) {
        setError("Gemini rate limit reached. Please wait 15–60 seconds and try again.");
        return;
      }

      setLatestDecisions(decisions);
      setPartialFailure(data.partialFailure);

      // Start cooldown to prevent rapid-fire submissions.
      setIsCooldown(true);
      cooldownTimer.current = setTimeout(() => setIsCooldown(false), COOLDOWN_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Trader Arena</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Submit a {STOCK_TICKER} headline and watch four AI traders react
            </p>
          </div>
          <PriceTicker price={currentPrice} previousPrice={previousPrice} />
        </div>

        {/* Input */}
        <HeadlineInput onSubmit={handleSubmit} isLoading={isLoading} isCooldown={isCooldown} />

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Partial failure banner */}
        {partialFailure && !error && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            Some agents encountered errors. Results may be incomplete.
          </div>
        )}

        {/* Agent cards */}
        <AgentPanel decisions={latestDecisions} isLoading={isLoading} />

        {/* Chart + log side by side on large screens */}
        {(priceHistory.length >= 2 || events.length > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PriceChart data={priceHistory} />
            <DecisionLog events={events} />
          </div>
        )}
      </div>
    </main>
  );
}
