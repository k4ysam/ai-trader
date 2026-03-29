# Paper Trading Platform — Blueprint

**Objective:** Replace the headline-analysis toy with a real simulated stock market platform where AI and rule-based bots trade with fake money against live Alpaca market data.

**Branch:** `feat/paper-trading-platform`

---

## Architecture Overview

```
Alpaca WebSocket (server-side singleton)
    │
    ▼
Stream Manager (lib/market/stream-manager.ts)
    │  price ticks
    ▼
Orchestrator (lib/orchestrator.ts)
    │  dispatches ticks to all bots
    ├──► Rule-Based Bots (RSI / SMA / Momentum / Mean-Reversion)
    └──► AI Bot (Gemini — the star, throttled to 1 call/15s per stock)
            │  all produce: Order { botId, ticker, action, qty }
            ▼
      Portfolio Engine (lib/portfolio.ts)
            │  executes orders, updates portfolios
            ▼
      SSE Broadcast (app/api/market/stream/route.ts)
            │
            ▼
      React Dashboard (app/page.tsx) — live via EventSource
```

**Key constraints:**
- Next.js App Router does not support native WebSocket servers — Alpaca WebSocket runs server-side (singleton); client connects via SSE
- AI Bot throttled: 1 Gemini call per stock per 15 seconds (not every tick) to control costs
- All portfolio math is pure functions — no side effects, fully unit-tested
- Alpaca paper trading account required; IEX feed is free and real-time for listed equities

---

## Stack Additions

| Package | Purpose |
|---------|---------|
| `ws` | Server-side WebSocket client to connect to Alpaca stream |
| `@alpacahq/typescript-sdk` | Typed Alpaca REST client (bars, snapshots) |
| `zod` | Runtime validation of bot import schemas and API inputs |

No new UI libraries — Recharts and Tailwind are sufficient.

---

## Default Watchlist

`NVDA, AAPL, TSLA, MSFT, AMD` — 5 stocks, configurable in `lib/constants.ts`

## Starting Configuration

- **Starting balance per bot:** $100,000
- **Max position size:** 20% of portfolio per stock
- **AI bot cadence:** 1 decision per stock per 15 seconds
- **Rule-based bots:** every tick (1-second intervals from Alpaca IEX)

---

## Phases

### Phase 1 — Project Reset & New Foundation
**Branch:** `feat/paper-trading-platform` (base branch for all phases)
**Dependencies:** None

**Context:** The existing codebase has NVDA-headline-analysis types and components. We keep the Gemini call pattern from `lib/agents.ts` (response validation, rate-limit handling) and the Recharts chart, but replace everything domain-specific with the new paper-trading domain.

**Tasks:**
- [ ] `git checkout -b feat/paper-trading-platform`
- [ ] Rewrite `types/index.ts` — new domain types (see schema below)
- [ ] Rewrite `lib/constants.ts` — WATCHLIST, STARTING_BALANCE, BOT cadence, model ID
- [ ] Delete: `lib/price-engine.ts`, `lib/personalities.ts`, `lib/rate-limit.ts`, `app/api/analyze/`
- [ ] Delete old components: `HeadlineInput`, `AgentCard`, `AgentPanel`, `DecisionLog`, `PriceTicker`
- [ ] Keep and preserve: `lib/agents.ts` pattern (Gemini call + validation) → will be reused in Phase 5
- [ ] Update `app/layout.tsx` title → "Paper Trader"
- [ ] Update `CLAUDE.md` key files table
- [ ] `npm run build` must pass

**New `types/index.ts` schema:**
```typescript
// Market data
export type Ticker = string                          // "NVDA", "AAPL", etc.
export interface MarketTick {
  ticker: Ticker
  price: number
  timestamp: number
  volume: number
}
export interface MarketSnapshot {
  ticker: Ticker
  price: number
  open: number
  high: number
  low: number
  prevClose: number
  change: number
  changePercent: number
}
export interface PriceBar {
  time: number      // unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Trading
export type TradeAction = "BUY" | "SELL" | "HOLD"
export interface Order {
  botId: string
  ticker: Ticker
  action: TradeAction
  qty: number                // shares
  price: number              // execution price (current market price)
  timestamp: number
  reasoning?: string         // AI bot only
}

// Portfolio
export interface Position {
  ticker: Ticker
  qty: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}
export interface Portfolio {
  botId: string
  cash: number
  positions: Record<Ticker, Position>
  totalValue: number          // cash + sum(marketValue)
  totalPnl: number            // totalValue - startingBalance
  totalPnlPct: number
  tradeHistory: Order[]
}

// Bots
export type BotType = "ai" | "rsi" | "sma-crossover" | "momentum" | "mean-reversion" | "custom"
export interface BotConfig {
  id: string
  name: string
  type: BotType
  color: string               // Tailwind hex for UI
  emoji: string
  params: Record<string, number>   // strategy-specific params (period, threshold, etc.)
  customCode?: string              // for "custom" type — serialized strategy JSON
}
export interface BotState {
  config: BotConfig
  portfolio: Portfolio
  lastDecision: Order | null
  isActive: boolean
}

// SSE event envelope sent to the client
export type SSEEventType = "tick" | "order" | "portfolio" | "snapshot" | "sim-status"
export interface SSEEvent {
  type: SSEEventType
  payload: unknown
}

// Simulation
export type SimStatus = "idle" | "running" | "paused"
export interface SimState {
  status: SimStatus
  bots: BotState[]
  watchlist: Ticker[]
  snapshots: Record<Ticker, MarketSnapshot>
  priceHistory: Record<Ticker, PriceBar[]>
}

// API
export interface ImportBotPayload {
  name: string
  type: BotType
  params: Record<string, number>
  emoji?: string
  color?: string
}
export interface ApiError {
  error: string
  code?: string
}
```

**New `lib/constants.ts`:**
```typescript
export const WATCHLIST: string[] = ["NVDA", "AAPL", "TSLA", "MSFT", "AMD"]
export const STARTING_BALANCE = 100_000
export const MAX_POSITION_PCT = 0.20          // max 20% of portfolio per stock
export const AI_BOT_CADENCE_MS = 15_000       // AI bot decision interval per stock
export const PRICE_HISTORY_BARS = 50          // bars to keep in memory per stock
export const MODEL_ID = "gemini-2.0-flash"
export const ALPACA_DATA_WS_URL = "wss://stream.data.alpaca.markets/v2/iex"
export const ALPACA_PAPER_BASE_URL = "https://paper-api.alpaca.markets"
export const ALPACA_DATA_BASE_URL = "https://data.alpaca.markets"
```

**Verification:**
```bash
npm run build   # must pass with zero errors
```

**Exit criteria:** Build passes, all old domain-specific code removed, new types compile clean.

---

### Phase 2 — Alpaca Market Data Layer
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 1

**Context:** Alpaca paper trading provides real-time IEX data (free). The stream manager maintains a single WebSocket connection to Alpaca's data feed and emits price events via Node.js EventEmitter. The REST client fetches historical bars and current snapshots.

**Tasks:**
- [ ] Install dependencies: `npm install ws zod @alpacahq/typescript-sdk`
- [ ] Install dev types: `npm install -D @types/ws`
- [ ] Add to `.env.local.example`: `ALPACA_API_KEY=`, `ALPACA_API_SECRET=`
- [ ] Create `lib/market/alpaca-rest.ts` — REST client
  - `getSnapshots(tickers: string[]): Promise<Record<string, MarketSnapshot>>`
  - `getBars(ticker: string, limit: number): Promise<PriceBar[]>`
  - Both use `ALPACA_DATA_BASE_URL`, auth via `APCA-API-KEY-ID` + `APCA-API-SECRET-KEY` headers
  - Input validated with Zod, responses narrowed with type guards
- [ ] Create `lib/market/stream-manager.ts` — Alpaca WebSocket singleton
  - Connects to `ALPACA_DATA_WS_URL` on first `getInstance()` call
  - Auth handshake: `{"action":"auth","key":"...","secret":"..."}`
  - Subscribe message: `{"action":"subscribe","trades":["NVDA","AAPL",...], "quotes":[], "bars":[]}`
  - Emits `"tick"` events (typed `MarketTick`) via `EventEmitter`
  - Auto-reconnect on disconnect (exponential backoff, max 30s)
  - Validates env vars at construction: throw if `ALPACA_API_KEY` missing
- [ ] Create `app/api/market/snapshot/route.ts` — GET, returns current snapshots for all watchlist tickers
- [ ] Create `app/api/market/stream/route.ts` — GET, SSE endpoint
  - Sets headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
  - Subscribes to StreamManager `"tick"` events, writes `data: <JSON>\n\n` to the response
  - Cleans up listener on client disconnect
- [ ] Unit tests: `lib/market/alpaca-rest.test.ts` — mock `fetch`, test snapshot parsing, bar parsing, error handling
- [ ] Unit tests: `lib/market/stream-manager.test.ts` — mock `ws`, test auth flow, tick emission, reconnect

**Alpaca WebSocket message format:**
```json
// Received trade tick:
[{"T":"t","S":"NVDA","p":875.50,"s":100,"t":"2024-01-15T14:30:00Z"}]
// T=message type, S=symbol, p=price, s=size/volume, t=timestamp
```

**Verification:**
```bash
npm run test    # alpaca-rest + stream-manager tests pass
npm run build   # no TypeScript errors
# Manual: ALPACA_API_KEY=xxx npm run dev → GET /api/market/snapshot returns prices
```

**Exit criteria:** SSE endpoint streams live ticks, snapshot endpoint returns real prices, unit tests pass.

---

### Phase 3 — Portfolio Engine
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 1

**Context:** Pure financial math — no side effects, no API calls. This is the accounting layer. Bots produce Orders; the portfolio engine executes them and tracks the resulting positions.

**Tasks:**
- [ ] Create `lib/portfolio.ts` — all pure functions
  - `createPortfolio(botId: string): Portfolio`
  - `executeOrder(portfolio: Portfolio, order: Order): Portfolio` — returns NEW portfolio (immutable)
    - Validates: sufficient cash for BUY, sufficient shares for SELL
    - Updates: position qty, avgCost (weighted), cash balance, tradeHistory
    - Returns unchanged portfolio if validation fails (no throws — log the rejection)
  - `updatePrices(portfolio: Portfolio, prices: Record<Ticker, number>): Portfolio`
    - Recomputes `currentPrice`, `marketValue`, `unrealizedPnl` for all positions
    - Recomputes `totalValue` and `totalPnl`
  - `calculateOrderQty(portfolio: Portfolio, ticker: string, action: TradeAction, price: number, sizePct: number): number`
    - BUY: floor((portfolio.cash * sizePct) / price) — respects MAX_POSITION_PCT cap
    - SELL: close full position (all shares)
    - HOLD: 0
- [ ] `lib/portfolio.test.ts` — full unit test suite
  - Test BUY: cash decreases, position created, avgCost correct
  - Test SELL: position closes, cash increases by market value
  - Test HOLD: no state change
  - Test insufficient cash → order rejected, portfolio unchanged
  - Test price update: unrealizedPnl recalculated correctly
  - Test qty calculation: respects MAX_POSITION_PCT
  - Target: 100% statement coverage

**Verification:**
```bash
npm run test:coverage   # lib/portfolio.ts must show 100% statement coverage
npm run build
```

**Exit criteria:** All portfolio math pure and tested. Zero mocks needed.

---

### Phase 4 — Rule-Based Bot Strategies
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 3

**Context:** Three rule-based bots act as benchmarks for the AI bot. Each implements a `Strategy` interface. They receive a price history window and return a `TradeAction` with confidence (0–1). The bot engine (Phase 6) calls these and converts the signal to an `Order` via the portfolio engine.

**Tasks:**
- [ ] Create `lib/strategies/types.ts`
  ```typescript
  export interface StrategyInput {
    ticker: Ticker
    bars: PriceBar[]          // historical bars, oldest first
    currentPrice: number
    portfolio: Portfolio
    params: Record<string, number>
  }
  export interface StrategySignal {
    action: TradeAction
    confidence: number        // 0–1
    reasoning: string         // human-readable, logged in trade history
  }
  export type Strategy = (input: StrategyInput) => StrategySignal
  ```
- [ ] Create `lib/strategies/rsi.ts`
  - Params: `period` (default 14), `overbought` (default 70), `oversold` (default 30)
  - RSI > overbought → SELL | RSI < oversold → BUY | else → HOLD
  - Confidence = how far RSI is from midpoint (50), normalized to 0–1
  - Returns HOLD if fewer bars than `period`
- [ ] Create `lib/strategies/sma-crossover.ts`
  - Params: `fastPeriod` (default 10), `slowPeriod` (default 30)
  - Fast SMA crosses above slow → BUY | crosses below → SELL | else → HOLD
  - Confidence = (fastSMA - slowSMA) / slowSMA, clamped to [0, 1]
  - Returns HOLD if fewer bars than `slowPeriod`
- [ ] Create `lib/strategies/momentum.ts`
  - Params: `lookback` (default 20), `threshold` (default 0.02 = 2%)
  - Price change over `lookback` bars > threshold → BUY | < -threshold → SELL | else → HOLD
  - Confidence = |pctChange| / (threshold * 5), clamped to [0, 1]
- [ ] Create `lib/strategies/mean-reversion.ts`
  - Params: `period` (default 20), `stdDevMultiplier` (default 2.0)
  - Price > mean + 2σ → SELL | Price < mean − 2σ → BUY | else → HOLD
  - Confidence = |deviation| / (stdDevMultiplier * σ), clamped to [0, 1]
- [ ] Unit tests for each strategy in `lib/strategies/*.test.ts`
  - Use synthetic price series fixtures (not real data) for determinism
  - Test: correct signal for clear trend, HOLD in ambiguous conditions, insufficient bars
  - Target: 90%+ branch coverage per strategy

**Default bot configs (added to constants):**
```typescript
export const DEFAULT_BOTS: BotConfig[] = [
  { id: "rsi-bot",        name: "RSI Ranger",    type: "rsi",           emoji: "📊", color: "#3b82f6", params: { period: 14, overbought: 70, oversold: 30 } },
  { id: "sma-bot",        name: "Trend Rider",   type: "sma-crossover", emoji: "📈", color: "#10b981", params: { fastPeriod: 10, slowPeriod: 30 } },
  { id: "momentum-bot",   name: "Mo Mentum",     type: "momentum",      emoji: "🚀", color: "#f59e0b", params: { lookback: 20, threshold: 0.02 } },
  { id: "reversion-bot",  name: "The Reverser",  type: "mean-reversion",emoji: "🔄", color: "#ef4444", params: { period: 20, stdDevMultiplier: 2.0 } },
]
```

**Verification:**
```bash
npm run test:coverage   # all strategy files ≥ 90% branch coverage
npm run build
```

**Exit criteria:** Four deterministic strategies with full test suites. No external dependencies.

---

### Phase 5 — AI Bot (The Star)
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 3, Phase 4

**Context:** The Gemini-powered AI bot is the centrepiece. It receives a rich market context (price history, current positions, watchlist snapshot, recent trades by rule-based bots) and acts as a real trader with a portfolio and P&L accountability. It is throttled to one decision per stock per 15 seconds to control cost. The validation pattern from the existing `lib/agents.ts` is reused.

**Tasks:**
- [ ] Create `lib/bots/ai-bot.ts`
  - `buildMarketContext(ticker: string, bars: PriceBar[], snapshot: MarketSnapshot, portfolio: Portfolio, recentOrders: Order[]): string`
    - Formats a concise prompt payload: price history summary (open/close/volume for last 10 bars), current position in this stock, cash remaining, last 3 rule-bot decisions for context
  - `parseAISignal(raw: unknown): StrategySignal` — validates JSON response from Gemini
    - Expected schema: `{ action: "BUY"|"SELL"|"HOLD", confidence: number (0-1), reasoning: string }`
    - Narrow with type guards (reuse pattern from existing `lib/agents.ts`)
    - On invalid response: return `{ action: "HOLD", confidence: 0, reasoning: "Parse error" }`
  - `callAIBot(ticker: string, input: StrategyInput, recentOrders: Order[]): Promise<StrategySignal>`
    - Constructs system prompt: "You are an AI hedge fund manager with $100k. Your goal is maximum portfolio return. Analyze the data and respond with ONLY valid JSON."
    - Calls Gemini `gemini-2.0-flash` with `thinkingBudget: 0` (same pattern as existing agents.ts)
    - Returns parsed signal or HOLD on error
  - `createAIBotConfig(): BotConfig` — returns the AI bot's static config
- [ ] Create `lib/bots/throttle.ts`
  - `createThrottle(intervalMs: number): (ticker: string, fn: () => Promise<StrategySignal>) => Promise<StrategySignal>`
  - Per-ticker cooldown: if called within `intervalMs` of last call for that ticker, return cached result
  - Allows different cadence per ticker (future-proof)
- [ ] Unit tests: `lib/bots/ai-bot.test.ts`
  - Mock Gemini SDK
  - Test valid JSON response → correct StrategySignal
  - Test malformed JSON → HOLD fallback
  - Test context builder: correct formatting, includes position data
- [ ] Unit tests: `lib/bots/throttle.test.ts`
  - Test within-interval returns cached result
  - Test after-interval calls fn again
  - Test per-ticker isolation

**AI Bot system prompt (baked into ai-bot.ts):**
```
You are ARIA — an AI hedge fund manager with $100,000 to trade.
Your goal is to maximize portfolio value over time.
You will receive real-time market data and must decide for ONE stock: BUY, SELL, or HOLD.

Rules:
- Never invest more than 20% of your portfolio in one stock
- You see what the rule-based bots just did — you don't have to agree with them
- Think contrarian when the data justifies it

Respond with ONLY valid JSON, no markdown, no prose:
{"action":"BUY"|"SELL"|"HOLD","confidence":0.0-1.0,"reasoning":"one sentence"}
```

**Verification:**
```bash
npm run test   # ai-bot + throttle tests pass (with mocked Gemini)
npm run build
```

**Exit criteria:** AI bot produces typed StrategySignals, throttle prevents API abuse, Gemini errors handled gracefully.

---

### Phase 6 — Bot Orchestrator & Simulation Control
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 2, Phase 3, Phase 4, Phase 5

**Context:** The orchestrator is the brain of the simulation. It receives ticks from StreamManager, dispatches them to all bots, executes resulting orders via the portfolio engine, and emits the updated state via an EventEmitter that the SSE route subscribes to.

**Tasks:**
- [ ] Create `lib/orchestrator.ts`
  - `Orchestrator` class (singleton via `getInstance()`)
  - State: `SimState` (status, bots, snapshots, priceHistory, watchlist)
  - `start()`: subscribes to StreamManager ticks, initializes bots with `DEFAULT_BOTS` + AI bot
  - `pause()` / `resume()`: toggle processing ticks
  - `reset()`: re-initializes all portfolios to `STARTING_BALANCE`, clears trade history
  - `onTick(tick: MarketTick)`:
    1. Update price history ring buffer (keep last `PRICE_HISTORY_BARS` bars)
    2. For each rule-based bot: call strategy synchronously → get signal → `calculateOrderQty()` → `executeOrder()`
    3. For AI bot: call `callAIBot()` (async, fire-and-forget if on cooldown) → on resolution execute order
    4. Call `updatePrices()` on all portfolios with new tick
    5. Emit `"state"` event with updated `SimState`
  - `addBot(config: BotConfig)`: add a new bot at runtime (custom import)
  - `removeBot(botId: string)`: remove bot
  - `updateBotParams(botId: string, params: Record<string, number>)`: hot-update strategy params
  - `getState(): SimState`: synchronous snapshot of current state
- [ ] Wire StreamManager → Orchestrator in a Next.js instrumentation file (`instrumentation.ts`)
  - `export async function register()` — called once on server startup
  - Calls `Orchestrator.getInstance().start()` only in Node.js runtime (not edge)
- [ ] Create `lib/state-broadcaster.ts`
  - Simple pub/sub: SSE route subscribes here, orchestrator publishes here
  - `subscribe(listener: (state: SimState) => void): () => void`
  - `publish(state: SimState): void`
  - Returns unsubscribe function for cleanup
- [ ] Unit tests: `lib/orchestrator.test.ts`
  - Mock StreamManager, mock strategy functions, mock Gemini
  - Test: tick received → rule-bot signal → order executed → portfolio updated
  - Test: pause → ticks ignored
  - Test: reset → portfolios back to starting balance

**Verification:**
```bash
npm run test   # orchestrator tests pass
npm run build
# Manual: start dev server, check console for "Orchestrator started" log
```

**Exit criteria:** Orchestrator processes ticks, executes orders, emits state updates.

---

### Phase 7 — API Routes
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 6

**Context:** REST + SSE routes expose the simulation to the browser. All routes are thin wrappers around orchestrator calls — no business logic in route handlers. Input is validated with Zod.

**Tasks:**
- [ ] `app/api/market/stream/route.ts` (GET — SSE)
  - Returns `text/event-stream` response
  - Subscribes to `StateBroadcaster`, writes `data: ${JSON.stringify(state)}\n\n` on each update
  - Sends initial state immediately on connect
  - Heartbeat `": keepalive\n\n"` every 15s to prevent proxy timeouts
  - Cleans up subscription on abort signal
- [ ] `app/api/market/snapshot/route.ts` (GET)
  - Returns `Orchestrator.getInstance().getState().snapshots`
- [ ] `app/api/sim/start/route.ts` (POST)
  - Calls `Orchestrator.getInstance().start()`
  - Returns `{ status: "running" }`
- [ ] `app/api/sim/pause/route.ts` (POST)
  - Calls `orchestrator.pause()`
- [ ] `app/api/sim/reset/route.ts` (POST)
  - Calls `orchestrator.reset()`
  - Returns new clean `SimState`
- [ ] `app/api/bots/route.ts` (GET / POST)
  - GET: returns all `BotState[]` from orchestrator
  - POST: validates `ImportBotPayload` with Zod → `orchestrator.addBot()` → returns new `BotState`
- [ ] `app/api/bots/[id]/route.ts` (GET / PATCH / DELETE)
  - PATCH: validates params subset with Zod → `orchestrator.updateBotParams()`
  - DELETE: `orchestrator.removeBot()`
- [ ] Add Zod validation schemas to `lib/validation.ts`
  - `importBotSchema`, `updateBotParamsSchema`
  - All route inputs validated at boundary — return 400 with `ApiError` on failure

**Verification:**
```bash
npm run build
# Manual smoke test with curl:
# curl -X POST http://localhost:3000/api/sim/start
# curl http://localhost:3000/api/market/snapshot
# curl http://localhost:3000/api/bots
```

**Exit criteria:** All routes return correct shapes, Zod rejects invalid input with 400.

---

### Phase 8 — Dashboard UI
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 7

**Context:** The client is a single React page. It connects to the SSE stream on mount and drives all UI from the incoming `SimState`. No internal simulation logic — pure display. WebSocket feel achieved via SSE + streaming state.

**Tasks:**
- [ ] Rewrite `app/page.tsx`
  - `"use client"` — all state in React
  - On mount: `new EventSource("/api/market/stream")` → `onmessage` updates `SimState`
  - Sim controls: Start / Pause / Reset buttons → POST to `/api/sim/*`
  - Layout: Header → Watchlist Ticker Bar → Bot Leaderboard → Trade Feed | selected bot detail
- [ ] Create `components/WatchlistBar.tsx`
  - Horizontal scrolling ticker: shows each stock symbol, current price, change %, color-coded
  - Pulses on new tick (CSS animation)
- [ ] Create `components/BotLeaderboard.tsx`
  - Ranked list of all bots sorted by `totalPnlPct`
  - Each row: rank badge, bot emoji + name, type badge, total P&L ($), P&L %, portfolio value
  - AI bot highlighted with distinct border/glow
  - Click row → show BotDetail panel
- [ ] Create `components/BotDetail.tsx`
  - Selected bot's full breakdown
  - Portfolio summary: cash, invested value, total value, total P&L
  - Positions table: ticker, qty, avg cost, current price, market value, unrealized P&L
  - Trade history: last 10 orders (ticker, action, qty, price, timestamp, reasoning if AI)
  - Strategy params (editable inline for rule-based bots — PATCH `/api/bots/[id]`)
- [ ] Create `components/TradeFeed.tsx`
  - Real-time feed of all orders across all bots
  - Each entry: bot emoji, bot name, BUY/SELL badge, qty shares of TICKER at $PRICE
  - Reasoning tooltip for AI bot trades
  - Auto-scroll to latest, virtualized if > 100 entries
- [ ] Create `components/PriceChart.tsx` (rewrite of existing)
  - Recharts `LineChart` per selected stock
  - Stock selector dropdown (NVDA / AAPL / TSLA / MSFT / AMD)
  - Overlays vertical markers where AI bot traded
- [ ] Create `components/BotImporter.tsx`
  - Modal dialog: name input, type selector (rule-based options), param sliders per type
  - JSON upload option: paste or file-upload a `ImportBotPayload` JSON
  - Validates client-side before POST to `/api/bots`
- [ ] Create `components/SimControls.tsx`
  - Start / Pause / Reset buttons with status indicator
  - Shows: elapsed time, tick count, active bots count

**Verification:**
```bash
npm run dev
# Manual: open browser → dashboard loads → Start sim → prices animate → bots trade → leaderboard updates
# Confirm AI bot trades appear in TradeFeed with reasoning
npm run build   # production build passes
```

**Exit criteria:** Full live simulation visible in browser. AI bot decisions visible with reasoning. Leaderboard updates in real-time.

---

### Phase 9 — E2E Tests & Polish
**Branch:** off `feat/paper-trading-platform`
**Dependencies:** Phase 8

**Context:** Playwright E2E covers the critical user flows. Impeccable design pass ensures the UI is production-quality. Final build verification before merging.

**Tasks:**
- [ ] Install Playwright: `npx playwright install --with-deps chromium`
- [ ] Create `e2e/simulation.spec.ts`
  - Flow 1: Page loads → dashboard renders → Start button visible
  - Flow 2: Click Start → status changes to "Running" → watchlist shows prices
  - Flow 3: Wait 5s → at least one trade appears in TradeFeed
  - Flow 4: Click bot in leaderboard → BotDetail panel opens
  - Flow 5: Click Pause → trading stops → Resume → trading resumes
  - Flow 6: Click Reset → all portfolios back to $100,000
  - Flow 7: Import bot modal → fill form → submit → new bot appears in leaderboard
- [ ] Run `/impeccable:arrange` — layout, spacing, hierarchy pass
- [ ] Run `/impeccable:colorize` — BUY/SELL/P&L color strategy (green/red consistent)
- [ ] Run `/impeccable:animate` — leaderboard re-sort animation, trade feed slide-in
- [ ] Run `/impeccable:polish` — final quality pass
- [ ] Final build gate:
  ```bash
  npm run build && npm run lint && npx playwright test
  ```
- [ ] Update `tasks/todo.md` with completed status
- [ ] Update `CLAUDE.md` key files table for new structure

**Verification:**
```bash
npx playwright test --reporter=list   # all 7 flows pass
npm run build   # zero errors, zero warnings
```

**Exit criteria:** All E2E flows pass. Production build clean. Design matches hero-3 aesthetic from prior work.

---

## Dependency Graph

```
Phase 1 (Foundation)
    ├──► Phase 2 (Alpaca Data)    ──┐
    ├──► Phase 3 (Portfolio)      ──┤
    │        └──► Phase 4 (Strategies) ─┤
    │                 └──► Phase 5 (AI Bot) ─┤
    │                                         ▼
    └─────────────────────────────────► Phase 6 (Orchestrator)
                                              │
                                              ▼
                                        Phase 7 (API Routes)
                                              │
                                              ▼
                                        Phase 8 (Dashboard UI)
                                              │
                                              ▼
                                        Phase 9 (E2E & Polish)
```

**Parallelizable:** Phases 2, 3, and 4 can run in parallel after Phase 1. Phase 5 needs Phase 3. Phase 6 needs 2+3+4+5.

---

## Environment Variables Required

```bash
# .env.local
ALPACA_API_KEY=your-alpaca-paper-key
ALPACA_API_SECRET=your-alpaca-paper-secret
GEMINI_API_KEY=your-gemini-key   # existing
```

Alpaca paper trading keys: create account at alpaca.markets → Paper Trading → API Keys

---

## Key Files (New Structure)

| File | Purpose |
|------|---------|
| `types/index.ts` | All domain types |
| `lib/constants.ts` | Watchlist, balance, cadence, URLs |
| `lib/market/alpaca-rest.ts` | Alpaca REST client |
| `lib/market/stream-manager.ts` | Alpaca WebSocket singleton |
| `lib/portfolio.ts` | Pure portfolio math |
| `lib/strategies/rsi.ts` | RSI strategy |
| `lib/strategies/sma-crossover.ts` | SMA crossover strategy |
| `lib/strategies/momentum.ts` | Momentum strategy |
| `lib/strategies/mean-reversion.ts` | Mean reversion strategy |
| `lib/bots/ai-bot.ts` | Gemini-powered AI bot |
| `lib/bots/throttle.ts` | Per-ticker AI call throttle |
| `lib/orchestrator.ts` | Simulation engine |
| `lib/state-broadcaster.ts` | SSE pub/sub |
| `lib/validation.ts` | Zod schemas for API inputs |
| `app/api/market/stream/route.ts` | SSE real-time stream |
| `app/api/market/snapshot/route.ts` | Current price snapshot |
| `app/api/sim/*/route.ts` | Simulation control endpoints |
| `app/api/bots/route.ts` | Bot CRUD |
| `app/page.tsx` | Dashboard (SSE client) |
| `components/WatchlistBar.tsx` | Live price ticker |
| `components/BotLeaderboard.tsx` | Bot ranking table |
| `components/BotDetail.tsx` | Portfolio + trade history |
| `components/TradeFeed.tsx` | Real-time order feed |
| `components/PriceChart.tsx` | Per-stock price chart |
| `components/BotImporter.tsx` | Import/create bot modal |
| `components/SimControls.tsx` | Start/Pause/Reset |
| `instrumentation.ts` | Server startup → orchestrator init |
| `e2e/simulation.spec.ts` | Playwright E2E tests |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Alpaca WebSocket disconnects | Auto-reconnect with exponential backoff in StreamManager |
| Gemini rate limits on AI bot | Per-ticker throttle (15s cooldown), HOLD on error |
| Next.js App Router singleton issue (hot reload resets singleton) | Use `globalThis` to persist singleton across HMR |
| Market closed (nights/weekends) | Detect empty tick stream → show "Market Closed" banner, freeze simulation |
| Portfolio goes negative | Validate order before execution — reject if insufficient cash/shares |
| SSE connection drops | Client-side auto-reconnect via `EventSource` (native browser behavior) |
| Custom bot import with malicious params | Zod validates param types + range limits on import |

---

## Open Questions (Decide Before Phase 8)

1. **Market closed mode**: Show last known prices frozen, or disable simulation UI entirely?
2. **Persistence**: Should portfolios persist across page refresh (localStorage) or reset on every visit?
3. **Bot import format**: JSON config only, or allow TypeScript strategy upload (much more complex — V2)?
