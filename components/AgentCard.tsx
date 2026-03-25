import type { AgentDecision, TradeAction } from "@/types";
import { AGENT_COLORS } from "@/lib/constants";
import { TRADER_PERSONALITIES } from "@/lib/personalities";

const ACTION_STYLES: Record<TradeAction, string> = {
  BUY:  "bg-green-500/20 text-green-400 border-green-500/40",
  SELL: "bg-red-500/20 text-red-400 border-red-500/40",
  HOLD: "bg-zinc-700/40 text-zinc-400 border-zinc-600/40",
};

const SIZE_LABEL: Record<string, string> = {
  aggressive: "Aggressive",
  moderate:   "Moderate",
  small:      "Small",
};

interface AgentCardProps {
  decision: AgentDecision;
  isLoading: boolean;
  fadeDelay?: number;
}

interface ThinkingSkeletonProps {
  traderName: string;
  archetype: string;
}

function ThinkingSkeleton({ traderName, archetype }: ThinkingSkeletonProps) {
  const colors = AGENT_COLORS[traderName];
  const personality = TRADER_PERSONALITIES.find((p) => p.name === traderName);
  const emoji = personality?.emoji ?? "🤖";

  const waveDelays = [0, 150, 300, 450, 600];

  return (
    <div
      className={`relative overflow-hidden flex flex-col gap-3 rounded-xl border bg-zinc-900 p-4 panel-depth ring-1 ring-white/5 animate-borderGlow ${colors?.border ?? "border-zinc-700"}`}
      style={{ "--glow-color": colors?.hex ?? "#3b82f6" } as React.CSSProperties}
    >
      {/* Scanline sweep */}
      <div
        className="animate-scanline pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${colors?.hex ?? "#3b82f6"}80, transparent)` }}
      />

      {/* Header — show real name/archetype so the card has identity */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
          style={{ background: `${colors?.hex ?? "#3b82f6"}20` }}
        >
          {emoji}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{traderName}</p>
          <p className="text-xs capitalize" style={{ color: colors?.hex ?? "#71717a" }}>
            {archetype}
          </p>
        </div>
      </div>

      {/* Waveform bars — "brain activity" indicator */}
      <div className="flex items-center justify-center gap-1 py-3">
        {waveDelays.map((delay, i) => (
          <div
            key={i}
            className="animate-waveform w-1 rounded-full"
            style={{
              animationDelay: `${delay}ms`,
              background: colors?.hex ?? "#3b82f6",
              height: "4px",
            }}
          />
        ))}
      </div>

      {/* Thinking dots + label */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex gap-1">
          {[0, 200, 400].map((delay, i) => (
            <div
              key={i}
              className="animate-dotPulse h-1.5 w-1.5 rounded-full"
              style={{ animationDelay: `${delay}ms`, background: colors?.hex ?? "#3b82f6" }}
            />
          ))}
        </div>
        <span className="text-xs" style={{ color: colors?.hex ?? "#71717a" }}>
          Analyzing...
        </span>
      </div>
    </div>
  );
}

export default function AgentCard({ decision, isLoading, fadeDelay = 0 }: AgentCardProps) {
  if (isLoading) {
    return <ThinkingSkeleton traderName={decision.traderName} archetype={decision.archetype} />;
  }

  const { traderName, archetype, reasoning, action, size, conviction, error } = decision;
  const colors = AGENT_COLORS[traderName];

  return (
    <div
      className="animate-fadeIn flex flex-col gap-3 rounded-xl border border-zinc-800/60 border-l-2 bg-zinc-900 p-4 panel-depth ring-1 ring-white/5"
      style={{
        animationDelay: `${fadeDelay}ms`,
        borderLeftColor: colors?.hex ?? "#3f3f46",
      }}
    >
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
                  className={`h-1.5 rounded-full transition-all ${colors?.bg ?? "bg-blue-500"}`}
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
