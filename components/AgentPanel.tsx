import type { AgentDecision } from "@/types";
import AgentCard from "./AgentCard";
import { TRADER_PERSONALITIES } from "@/lib/personalities";

interface AgentPanelProps {
  decisions: AgentDecision[] | null;
  isLoading: boolean;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {TRADER_PERSONALITIES.map((p) => (
        <AgentCard
          key={p.name}
          decision={{
            traderName: p.name,
            archetype: p.archetype,
            reasoning: ["", "", ""],
            action: "HOLD",
            size: "small",
            conviction: 5,
          }}
          isLoading={true}
        />
      ))}
    </div>
  );
}

export default function AgentPanel({ decisions, isLoading }: AgentPanelProps) {
  if (isLoading) return <SkeletonGrid />;

  if (!decisions) {
    return (
      <div className="dot-grid-bg flex items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-sm text-zinc-500">
        Submit a headline to see agent decisions
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {decisions.map((decision, index) => (
        <AgentCard key={decision.traderName} decision={decision} isLoading={false} fadeDelay={index * 100} />
      ))}
    </div>
  );
}
