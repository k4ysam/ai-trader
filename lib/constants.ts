export const STARTING_PRICE = 875;
export const MODEL_ID = "gemini-2.5-flash";
export const MAX_PRICE_CHANGE_PERCENT = 5;
export const STOCK_TICKER = "NVDA";

export interface AgentColorConfig {
  hex: string;
  border: string;
  bg: string;
  text: string;
  glowVar: string;
}

export const AGENT_COLORS: Record<string, AgentColorConfig> = {
  Marcus:       { hex: "#3b82f6", border: "border-blue-500/50",    bg: "bg-blue-500",    text: "text-blue-400",    glowVar: "var(--agent-marcus)" },
  Vera:         { hex: "#a855f7", border: "border-purple-500/50",  bg: "bg-purple-500",  text: "text-purple-400",  glowVar: "var(--agent-vera)" },
  "Dr. Reeves": { hex: "#10b981", border: "border-emerald-500/50", bg: "bg-emerald-500", text: "text-emerald-400", glowVar: "var(--agent-reeves)" },
  Eddie:        { hex: "#ef4444", border: "border-red-500/50",     bg: "bg-red-500",     text: "text-red-400",     glowVar: "var(--agent-eddie)" },
};
