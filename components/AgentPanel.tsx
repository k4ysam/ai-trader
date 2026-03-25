import type { AgentDecision } from "@/types";
import AgentCard from "./AgentCard";
import { TRADER_PERSONALITIES } from "@/lib/agents";

interface AgentPanelProps {
  decisions: AgentDecision[] | null;
  isLoading: boolean;
}

export default function AgentPanel({ decisions, isLoading }: AgentPanelProps) {
  if (!isLoading && !decisions) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-700 py-12 text-sm text-zinc-500">
        Submit a headline to see agent decisions
      </div>
    );
  }

  // While loading, render 4 skeletons keyed by personality name
  const cards = TRADER_PERSONALITIES.map((p, i) => {
    const decision = decisions?.[i] ?? {
      traderName: p.name,
      archetype: p.archetype,
      reasoning: ["", "", ""] as [string, string, string],
      action: "HOLD" as const,
      size: "small" as const,
      conviction: 5,
    };
    return (
      <AgentCard key={p.name} decision={decision} isLoading={isLoading} />
    );
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards}
    </div>
  );
}
