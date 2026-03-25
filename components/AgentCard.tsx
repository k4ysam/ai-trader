import type { AgentDecision, TradeAction } from "@/types";

const ACTION_STYLES: Record<TradeAction, string> = {
  BUY: "bg-green-500/20 text-green-400 border-green-500/40",
  SELL: "bg-red-500/20 text-red-400 border-red-500/40",
  HOLD: "bg-zinc-700/40 text-zinc-400 border-zinc-600/40",
};

const SIZE_LABEL: Record<string, string> = {
  aggressive: "Aggressive",
  moderate: "Moderate",
  small: "Small",
};

interface AgentCardProps {
  decision: AgentDecision;
  isLoading: boolean;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-zinc-700" />
        <div className="h-4 w-24 rounded bg-zinc-700" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-5/6 rounded bg-zinc-800" />
        <div className="h-3 w-4/6 rounded bg-zinc-800" />
      </div>
      <div className="h-6 w-16 rounded bg-zinc-700" />
    </div>
  );
}

export default function AgentCard({ decision, isLoading }: AgentCardProps) {
  if (isLoading) return <Skeleton />;

  const { traderName, archetype, reasoning, action, size, conviction, error } = decision;

  return (
    <div className="animate-fadeIn flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">{traderName}</p>
          <p className="text-xs capitalize text-zinc-500">{archetype}</p>
        </div>
        {!error && (
          <span
            className={`rounded-full border px-3 py-0.5 text-xs font-bold tracking-wide ${ACTION_STYLES[action]}`}
          >
            {action}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-xs text-red-400">⚠ Agent error: {error}</p>
      ) : (
        <>
          {/* Reasoning steps */}
          <ol className="space-y-1.5">
            {reasoning.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-400">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {/* Size + Conviction */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-zinc-500">{SIZE_LABEL[size]}</span>
            <div className="flex flex-1 items-center gap-2">
              <div className="flex-1 rounded-full bg-zinc-800 h-1.5">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${(conviction / 10) * 100}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-zinc-400">
                {conviction}/10
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
