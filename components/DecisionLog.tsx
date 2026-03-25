import type { PriceEvent, TradeAction } from "@/types";

interface DecisionLogProps {
  events: PriceEvent[];
}

const ACTION_COLOR: Record<TradeAction, string> = {
  BUY: "text-green-400",
  SELL: "text-red-400",
  HOLD: "text-zinc-400",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function DecisionLog({ events }: DecisionLogProps) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900 p-4 panel-depth ring-1 ring-white/5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Event Log
      </p>
      <ol className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {[...events].reverse().map((event) => {
          const { priceResult } = event;
          const deltaSign = priceResult.delta >= 0 ? "+" : "";
          const deltaColor = priceResult.delta > 0 ? "text-green-400" : priceResult.delta < 0 ? "text-red-400" : "text-zinc-400";
          return (
            <li
              key={event.id}
              className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-zinc-300">{event.headline}</span>
                <span className="shrink-0 text-xs text-zinc-600">{formatTime(event.timestamp)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${ACTION_COLOR[priceResult.dominantAction]}`}>
                  {priceResult.dominantAction}
                </span>
                <span className={`text-xs tabular-nums ${deltaColor}`}>
                  {deltaSign}{priceResult.delta.toFixed(2)} ({deltaSign}{priceResult.percentChange.toFixed(2)}%)
                </span>
                <span className="text-xs text-zinc-500">→ ${priceResult.newPrice.toFixed(2)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
