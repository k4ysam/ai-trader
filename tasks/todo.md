# AI Trader - Implementation Plan

## Overview

A single-page web app where users submit NVDA news headlines. Four AI trader agents
(each with a distinct personality) independently analyze headlines via Claude claude-sonnet-4-5 and
return structured BUY/SELL/HOLD decisions. A pure-function price engine aggregates
their conviction-weighted actions to move a simulated NVDA price (max +/-5%).
The UI shows agent reasoning cards, a live price chart, and a scrollable decision log.

---

## File Structure

```
ai-trader/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # POST /api/analyze endpoint
│   ├── globals.css               # (existing) Tailwind + custom vars
│   ├── layout.tsx                # (existing) update metadata
│   └── page.tsx                  # (existing) replace with main UI
├── components/
│   ├── HeadlineInput.tsx         # Form with submit + loading state
│   ├── AgentCard.tsx             # Single trader card (reasoning, action, conviction)
│   ├── AgentPanel.tsx            # Grid of 4 AgentCards
│   ├── PriceTicker.tsx           # Current price + delta display
│   ├── PriceChart.tsx            # Recharts line chart of price history
│   └── DecisionLog.tsx           # Scrollable past events list
├── lib/
│   ├── price-engine.ts           # Pure function: calculateNewPrice()
│   ├── agents.ts                 # Agent prompt definitions + call helper
│   └── constants.ts              # Starting price, model ID, clamp values
├── types/
│   └── index.ts                  # All TypeScript interfaces
└── tasks/
    └── todo.md                   # This file
```

---

## Phase 1: Types & Constants & Price Engine

> Goal: Build the foundational layer with zero external dependencies. Everything
> here is pure TypeScript — testable in isolation with no API calls.

### Type Definitions (`types/index.ts`)

- [x] **1.1** Create `types/index.ts` with all interfaces

```ts
export type TradeAction = "BUY" | "SELL" | "HOLD";
export type TradeSize = "aggressive" | "moderate" | "small";

export interface AgentDecision {
  traderName: string;
  archetype: string;
  reasoning: [string, string, string]; // exactly 3 steps
  action: TradeAction;
  size: TradeSize;
  conviction: number;   // 1-10 integer
  error?: string;       // set if this agent failed
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
  color: string;        // Tailwind color for card accent
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
```

### Constants (`lib/constants.ts`)

- [x] **1.2** Create `lib/constants.ts`

```ts
export const STARTING_PRICE = 875;
export const MODEL_ID = "claude-sonnet-4-5";
export const MAX_PRICE_CHANGE_PERCENT = 5;
export const STOCK_TICKER = "NVDA";
```

### Price Engine (`lib/price-engine.ts`)

- [x] **1.3** Implement `calculateNewPrice()` as a pure function

**Formula:**
- Each agent contributes: `direction × sizeMultiplier × (conviction / 10)`
  - BUY = +1, SELL = -1, HOLD = 0
  - aggressive = 1.0, moderate = 0.6, small = 0.3
- Sum all contributions, divide by sum of weights → normalized score in [-1, 1]
- Multiply by MAX_PRICE_CHANGE_PERCENT → percent change
- Clamp to ±5%, apply to current price

```ts
export function calculateNewPrice(
  currentPrice: number,
  decisions: AgentDecision[]
): PriceEngineResult
```

### Phase 1 Acceptance Criteria

- [x] `types/index.ts` compiles with zero errors
- [x] `lib/constants.ts` exports all 4 constants
- [x] `calculateNewPrice()` hand-verified: 39 tests, 100% stmt/func, 90% branch
- [x] Price engine is a pure function (no side effects, no external imports beyond types)
- [x] `npm run build` passes

---

## Phase 2: Agent Prompt Design & Helper (`lib/agents.ts`)

> Goal: Define the 4 trader personalities with system prompts that enforce
> JSON-only responses. Build the helper that calls Claude and parses the result.

### JSON Schema the LLM Must Return

```json
{
  "reasoning": [
    "Step 1: <observation about the headline>",
    "Step 2: <analysis through this trader's lens>",
    "Step 3: <decision rationale>"
  ],
  "action": "BUY",
  "size": "aggressive",
  "conviction": 8
}
```

### System Prompt Structure (each trader)

1. **Role**: "You are {name}, a {archetype} stock trader."
2. **Personality rules**: 3–5 behavioral directives specific to the archetype
3. **Output contract**: "You MUST respond with ONLY a valid JSON object. No markdown. No code fences. No prose before or after the JSON."
4. **JSON schema**: Exact schema embedded in prompt
5. **Constraints**: conviction = integer 1–10, action = BUY/SELL/HOLD, size = aggressive/moderate/small

### Personality Guidelines

| Trader | Personality Rules |
|--------|------------------|
| **Marcus** (Momentum) | Follows trends fast. Positive sentiment = BUY aggressive. Negative = SELL fast. Hates being late. High conviction on clear trends. |
| **Vera** (Contrarian) | Does the opposite of the crowd. Panic = BUY opportunity. Euphoria = SELL. Moderate conviction unless extreme sentiment. |
| **Dr. Reeves** (Fundamental) | Only cares about earnings, revenue, margins, competitive moat. Ignores noise. Often HOLDs. Low conviction on sentiment-only headlines. |
| **Eddie** (Panic Seller) | Any uncertainty or negative word = SELL. High conviction on bad news. Rarely BUYs. Always suspicious. |

### Tasks

- [x] **2.1** Define `TRADER_PERSONALITIES: TraderPersonality[]` with all 4 entries (name, archetype, color, emoji, systemPrompt)
- [x] **2.2** Implement `callAgent(personality, headline, currentPrice): Promise<AgentDecision>`
- [x] **2.3** Implement `analyzeHeadline(headline, currentPrice): Promise<{ decisions, partialFailure }>`

### Phase 2 Acceptance Criteria

- [x] Each system prompt enforces JSON-only output
- [x] `callAgent()` handles malformed JSON without throwing
- [x] `analyzeHeadline()` always returns 4 decisions (some may have `error`)
- [x] Model ID is `claude-sonnet-4-5`
- [x] Temperature 0.7
- [x] `npm run build` passes

---

## Phase 3: API Route (`app/api/analyze/route.ts`)

> Goal: Single POST endpoint orchestrating agents and price engine.

- [x] **3.1** Create `app/api/analyze/route.ts`
  - Input validation: `headline` non-empty string ≤500 chars, `currentPrice` positive number
  - Call `analyzeHeadline()` → call `calculateNewPrice()`
  - Return `AnalyzeResponse` on 200
  - Return 400 on bad input, 500 on unexpected error

- [x] **3.2** Environment setup
  - Create `.env.local.example` with `ANTHROPIC_API_KEY=your-key-here`
  - Anthropic SDK reads `ANTHROPIC_API_KEY` automatically

### Phase 3 Acceptance Criteria

- [x] `POST /api/analyze` returns valid `AnalyzeResponse`
- [x] Invalid input → 400 with descriptive error
- [x] Missing API key → 500 (not a crash)
- [x] Partial agent failure → 200 with `partialFailure: true`
- [x] `npm run build` passes

---

## Phase 4: UI Components

> Goal: All frontend components. Page manages state, calls API, renders results.
> Zero business logic in the frontend.

### State in `page.tsx`

```ts
const [currentPrice, setCurrentPrice] = useState(STARTING_PRICE);
const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([
  { time: "Start", price: STARTING_PRICE }
]);
const [events, setEvents] = useState<PriceEvent[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Components

- [ ] **4.1** `components/PriceTicker.tsx`
  - Props: `price`, `previousPrice | null`
  - Shows: "NVDA", current price, delta with color (green up / red down / gray neutral)

- [ ] **4.2** `components/HeadlineInput.tsx`
  - Props: `onSubmit: (headline: string) => void`, `isLoading: boolean`
  - Text input + submit button, disabled during loading
  - Clears after submit, submits on Enter

- [ ] **4.3** `components/AgentCard.tsx`
  - Props: `decision: AgentDecision`, `isLoading: boolean`
  - Shows: name + emoji, archetype label
  - 3 numbered reasoning steps
  - Action badge (green BUY / red SELL / gray HOLD)
  - Size label
  - Conviction bar (1–10 scale)
  - Error state if `decision.error`
  - Skeleton loading state

- [ ] **4.4** `components/AgentPanel.tsx`
  - Props: `decisions: AgentDecision[] | null`, `isLoading: boolean`
  - Responsive grid: 1 col mobile / 2 col tablet / 4 col desktop
  - Empty state when no decisions yet

- [ ] **4.5** `components/PriceChart.tsx`
  - Props: `data: { time: string; price: number }[]`
  - Recharts `LineChart` with `ResponsiveContainer`
  - Dollar-formatted Y-axis, time X-axis
  - Hover tooltip

- [ ] **4.6** `components/DecisionLog.tsx`
  - Props: `events: PriceEvent[]`
  - Scrollable, max-height, most recent first
  - Each entry: headline (truncated), price old→new, timestamp, color-coded

- [ ] **4.7** `app/page.tsx` — main page wiring
  - `"use client"` directive
  - Layout: header (title + PriceTicker) → HeadlineInput → AgentPanel → PriceChart + DecisionLog
  - `handleSubmit`: fetch → update price → append history → prepend event → handle errors

- [ ] **4.8** Update `app/layout.tsx` metadata
  - Title: "AI Trader Arena"

### Phase 4 Acceptance Criteria

- [ ] Full flow works: submit headline → loading → 4 agent cards populated
- [ ] Price chart updates with each submission
- [ ] Decision log shows history in reverse order
- [ ] Responsive on mobile and desktop
- [ ] No business logic in any component
- [ ] `npm run dev` works end-to-end

---

## Phase 5: Polish & Error Handling

- [ ] **5.1** JSON parse retry: regex-extract `/{[\s\S]*}/` from response before marking agent failed
- [ ] **5.2** Disable submit for 1s after response (prevent rapid fire)
- [ ] **5.3** Fade-in animations on agent cards when results arrive
- [ ] **5.4** Clickable example headlines below input:
  - "NVDA beats Q4 earnings by 20%, data center revenue surges"
  - "SEC announces investigation into NVDA accounting practices"
  - "NVDA announces 10-for-1 stock split"
  - "Competitor AMD unveils chip that matches NVDA H100 performance"
- [ ] **5.5** Dark mode support (respect system preference)
- [ ] **5.6** Final verification: `npm run build`, `npm run lint`, manual E2E with 5 headlines

### Phase 5 Acceptance Criteria

- [ ] Malformed agent responses handled gracefully (no white screen)
- [ ] Example headlines clickable and functional
- [ ] Production build passes with zero warnings

---

## Future Extensibility (Plan For, Do Not Build)

| Feature | Architecture Note |
|---------|------------------|
| **Agent memory** | Add `memory: PriceEvent[]` param to `callAgent()`. Inject last N events into user message. No system prompt changes needed. |
| **Portfolio per agent** | Add `Portfolio` type `{ cash, shares, totalValue }`. Pass into `callAgent()`, update after each decision. Keep engine pure by passing portfolios in/out. |
| **Cross-agent awareness** | Two-phase `analyzeHeadline()`: Phase 1 = independent decisions, Phase 2 = each agent sees others' decisions. Keep phases as separate functions. |
| **Multi-stock** | Generalize `PriceEvent` with `ticker: string`. Price engine takes `stock` param. UI adds stock selector dropdown. |
| **New archetypes** | Add entries to `TRADER_PERSONALITIES` array. `Promise.allSettled()` pattern means zero other code changes. |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Claude returns non-JSON | Strip fences → regex extract → retry once → show partial results |
| All 4 agents fail | Return 500 with clear error. UI shows "All agents failed" state. |
| Slow response (4 parallel Claude calls) | Loading skeletons + disable input during loading |
| Conviction/size too similar → boring | Exaggerate personality differences in prompts. Temperature 0.7 helps. |
| Price drifts unrealistically | ±5% clamp per round. Add absolute bounds in future if needed. |

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
 Types       Agents      API Route    UI           Polish
 Constants   Prompts     Validation   Components   Error handling
 Engine      SDK calls   Integration  Page state   Animations
```

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `types/index.ts` | All TypeScript interfaces |
| `lib/constants.ts` | Config values |
| `lib/price-engine.ts` | Pure price calculation |
| `lib/agents.ts` | Agent prompts + Claude SDK calls |
| `app/api/analyze/route.ts` | POST endpoint |
| `app/page.tsx` | Main UI (client component) |
| `components/AgentCard.tsx` | Single trader card |
| `components/AgentPanel.tsx` | 4-card grid |
| `components/PriceTicker.tsx` | Price display |
| `components/PriceChart.tsx` | Recharts line chart |
| `components/DecisionLog.tsx` | Event history |
| `components/HeadlineInput.tsx` | Input form |
