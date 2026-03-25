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
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white dot-grid-bg">
      {/* Ambient radial gradient blobs (hero-3 signature) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,#3b82f620,transparent_70%)] blur-[70px]" />
        <div className="absolute top-1/3 -left-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,#a855f715,transparent_70%)] blur-[80px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,#10b98112,transparent_70%)] blur-[80px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* hero-3 pill badge */}
            <div className="animate-in slide-in-from-bottom-10 fill-mode-backwards delay-100 duration-500 mb-3 flex w-fit items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/80 px-2 py-1 shadow-sm backdrop-blur-sm">
              <span className="rounded-sm border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
                LIVE
              </span>
              <span className="text-xs text-zinc-400">AI-powered NVDA trading simulation</span>
              <span className="block h-3 border-l border-zinc-700" />
              <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h1 className="animate-in slide-in-from-bottom-10 fill-mode-backwards delay-200 duration-500 text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              AI Trader Arena
            </h1>
            <p className="animate-in slide-in-from-bottom-10 fill-mode-backwards delay-300 duration-500 text-sm text-zinc-500 mt-1">
              Submit a {STOCK_TICKER} headline and watch four AI traders react
            </p>
          </div>
          <div className="glass-panel rounded-xl border border-zinc-800/60 px-4 py-2 shrink-0">
            <PriceTicker price={currentPrice} previousPrice={previousPrice} />
          </div>
        </div>

        {/* Input */}
        <div className="animate-in slide-in-from-bottom-5 fill-mode-backwards delay-500 duration-700">
          <HeadlineInput onSubmit={handleSubmit} isLoading={isLoading} isCooldown={isCooldown} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Partial failure banner */}
        {partialFailure && !error && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400 backdrop-blur-sm">
            Some agents encountered errors. Results may be incomplete.
          </div>
        )}

        {/* Agent cards */}
        <div className="animate-in slide-in-from-bottom-5 fill-mode-backwards delay-700 duration-700">
          <AgentPanel decisions={latestDecisions} isLoading={isLoading} />
        </div>

        {/* Chart + log side by side on large screens */}
        {(priceHistory.length >= 2 || events.length > 0) && (
          <div className="animate-in slide-in-from-bottom-5 fill-mode-backwards delay-1000 duration-1000 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PriceChart data={priceHistory} />
            <DecisionLog events={events} />
          </div>
        )}
      </div>
    </main>
  );
}
