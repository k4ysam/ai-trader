import { STOCK_TICKER } from "@/lib/constants";

interface PriceTickerProps {
  price: number;
  previousPrice: number | null;
}

export default function PriceTicker({ price, previousPrice }: PriceTickerProps) {
  const delta = previousPrice !== null ? price - previousPrice : 0;
  const isUp = delta > 0;
  const isDown = delta < 0;

  const deltaColor = isUp
    ? "text-green-400"
    : isDown
    ? "text-red-400"
    : "text-zinc-400";

  const arrow = isUp ? "▲" : isDown ? "▼" : "—";

  const flashColor = isUp ? "#10b98118" : isDown ? "#ef444418" : "transparent";

  return (
    <div className="flex items-baseline gap-4">
      <span className="text-zinc-400 font-mono text-sm font-semibold tracking-widest">
        {STOCK_TICKER}
      </span>
      <span
        key={price}
        className="animate-priceFlash text-3xl font-bold text-white tabular-nums rounded px-1"
        style={{ "--flash-color": flashColor } as React.CSSProperties}
      >
        ${price.toFixed(2)}
      </span>
      {previousPrice !== null && (
        <span className={`text-sm font-semibold tabular-nums ${deltaColor}`}>
          {arrow} {isDown ? "" : "+"}
          {delta.toFixed(2)} ({((delta / previousPrice) * 100).toFixed(2)}%)
        </span>
      )}
    </div>
  );
}
