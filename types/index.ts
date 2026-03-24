export type TradeAction = "BUY" | "SELL" | "HOLD";
export type TradeSize = "aggressive" | "moderate" | "small";

export interface AgentDecision {
  traderName: string;
  archetype: string;
  reasoning: [string, string, string];
  action: TradeAction;
  size: TradeSize;
  conviction: number;
  error?: string;
}

export interface AgentRawResponse {
  reasoning: [string, string, string];
  action: TradeAction;
  size: TradeSize;
  conviction: number;
}

export interface TraderPersonality {
  name: string;
  archetype: string;
  color: string;
  emoji: string;
  systemPrompt: string;
}

export interface PriceEngineResult {
  newPrice: number;
  oldPrice: number;
  delta: number;
  percentChange: number;
  dominantAction: TradeAction;
}

export interface PriceEvent {
  id: string;
  timestamp: number;
  headline: string;
  decisions: AgentDecision[];
  priceResult: PriceEngineResult;
}

export interface AnalyzeRequest {
  headline: string;
  currentPrice: number;
}

export interface AnalyzeResponse {
  decisions: AgentDecision[];
  priceResult: PriceEngineResult;
  partialFailure: boolean;
}
