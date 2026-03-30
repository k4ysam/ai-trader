# AI Trader

A Next.js paper trading simulation where AI and rule-based bots trade real stocks with fake money against live market data — with a **Community Layer** showing aggregated sentiment from thousands of simulated sessions, and a **Replay Mode** to test against historical data on weekends or after-hours.

## Overview

- **5 trading bots** — RSI Ranger, Trend Rider (SMA Crossover), Mo Mentum, The Reverser (Mean Reversion), and ARIA (AI/Gemini) — each starting with $100,000
- **Live mode** — streams real-time 1-minute ticks from Alpaca's IEX WebSocket feed
- **Replay mode** — replays any past trading day's 1-minute bars at 1×/5×/10×/50× speed; works on weekends/after-hours with no live feed required
- **Community layer** — aggregates sentiment (bull/bear/hold) and strategy P&L across 1,000+ simulated bot sessions per ticker in real time
- **Watchlist** — NVDA, AAPL, TSLA, MSFT, AMD tracked simultaneously
- **Leaderboard** tracks each bot's portfolio value, P&L, and trade history in real time

**Stack**: Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · `@google/genai` · Alpaca Markets API · Upstash Redis (optional)

---

## Setup

### Prerequisites

- Node.js 20+
- [Alpaca Markets](https://alpaca.markets/) account (free) — for live market data + paper trading API
- [Google AI Studio](https://aistudio.google.com/) API key — for the ARIA AI bot (optional; other bots work without it)
- [Upstash Redis](https://upstash.com/) (optional) — enables persistent community data across sessions; falls back to in-memory simulation if not configured

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your keys
```

| Variable | Required | Description |
|----------|----------|-------------|
| `ALPACA_API_KEY` | Yes | Alpaca API key (paper trading account) |
| `ALPACA_API_SECRET` | Yes | Alpaca API secret |
| `GEMINI_API_KEY` | No | Google Gemini API key — powers the ARIA AI bot |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL — enables persistent community aggregation |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build with type checking |
| `npm start` | Start production server (requires build first) |
| `npm test` | Run test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## Usage

### Live mode (market hours)

1. Start the dev server: `npm run dev`
2. Open [localhost:3000](http://localhost:3000)
3. Click **Start** — bots begin trading on live ticks from Alpaca

### Replay mode (weekends / after-hours)

1. Toggle **Replay** in the sim controls
2. Click **Start Replay** — fetches the last trading day's 1-minute bars from Alpaca REST
3. Use the speed buttons (**1× 5× 10× 50×**) to control playback speed
4. Bots trade exactly as they would in live mode — same strategies, same order execution

### Community panel

The Community tab shows aggregated data from all active sessions:

- **Sentiment** — bull/bear/hold breakdown across 1,000+ simulated bots per ticker
- **Strategy breakdown** — which strategy types are most bullish, and their median P&L
- **P&L distribution** — percentile chart of returns across the community
- **Live feed** — real-time trade events from other sessions
- **History** — 24-hour sentiment trend chart (requires Postgres or in-memory store)

---

## Architecture

```
Alpaca WebSocket ──► StreamManager ──► Orchestrator ──► StateBroadcaster ──► SSE ──► UI
Alpaca REST      ──► ReplayEngine  ──►           ↑
                                       Bot strategies (RSI, SMA, Momentum, MeanReversion, AI)

Community:
useHeartbeat (UI) ──► POST /api/community/heartbeat ──► CommunityAggregator
                                                              ↓ Redis (real) or Simulator (in-memory)
GET /api/community/aggregate ◄─────────────────────────── aggregated state
GET /api/community/stream    ◄─────────────────────────── SSE broadcast
```

- **`Orchestrator`** — singleton that dispatches ticks to bots, executes orders, updates portfolios
- **`StreamManager`** — wraps the Alpaca WebSocket; emits `tick` events during market hours
- **`ReplayEngine`** — fetches historical bars, sorts them chronologically across tickers, emits identical `tick` events on a timer
- **`StateBroadcaster`** — fans out `SimState` to all connected SSE clients
- **`CommunityAggregator`** — batches heartbeat data into Redis (or in-memory simulator); exposes aggregated sentiment per ticker

Both `StreamManager` and `ReplayEngine` emit the same `MarketTick` shape — the `Orchestrator` is tick-source agnostic.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/market/stream` | GET (SSE) | Streams full `SimState` to the UI |
| `/api/market/snapshot` | GET | Current price snapshots for all watchlist tickers |
| `/api/sim/start` | POST | Start simulation. Body: `{ mode?: "live"\|"replay", speed?: 1\|5\|10\|50, date?: "YYYY-MM-DD" }` |
| `/api/sim/pause` | POST | Pause simulation |
| `/api/sim/resume` | POST | Resume simulation |
| `/api/sim/reset` | POST | Reset all bots and state |
| `/api/sim/replay-speed` | POST | Change replay speed mid-playback. Body: `{ speed: 1\|5\|10\|50 }` |
| `/api/bots` | GET/POST | List bots / add a custom bot |
| `/api/bots/[id]` | GET/PATCH/DELETE | Get / update params / remove a bot |
| `/api/community/stream` | GET (SSE) | Streams aggregated community state |
| `/api/community/aggregate` | GET | Current community sentiment snapshot |
| `/api/community/heartbeat` | POST | Publish a session's bot activity to the community |
| `/api/community/history` | GET | 24-hour sentiment history (query: `?ticker=NVDA`) |

---

## Key files

| File | Purpose |
|------|---------|
| `types/index.ts` | All TypeScript interfaces (`SimState`, `BotState`, `ReplayState`, `CommunityState`, etc.) |
| `lib/constants.ts` | Watchlist, default bot configs, timing constants |
| `lib/orchestrator.ts` | Core simulation engine — tick dispatch, order execution |
| `lib/market/stream-manager.ts` | Alpaca WebSocket client |
| `lib/market/replay-engine.ts` | Historical bar replay with configurable speed |
| `lib/market/alpaca-rest.ts` | REST client — snapshots, bars, last trading day |
| `lib/portfolio.ts` | Pure portfolio math — buy/sell execution, P&L |
| `lib/strategies/` | RSI, SMA crossover, momentum, mean reversion strategies |
| `lib/bots/ai-bot.ts` | ARIA — Gemini-powered trading bot |
| `lib/community/aggregator.ts` | Pure community aggregation logic |
| `lib/community/community-aggregator.ts` | Singleton aggregator with Redis or in-memory backend |
| `lib/community/simulator.ts` | Generates synthetic community data when Redis is not configured |
| `lib/community/store.ts` | Upstash Redis store — batched writes, SCAN aggregation, rate limiting |
| `lib/community/use-heartbeat.ts` | React hook — publishes session activity to community on an interval |
| `app/page.tsx` | Main UI — SSE client, all state |
| `components/SimControls.tsx` | Start/pause/reset + mode toggle + replay speed |
| `components/community/` | SentimentGauge, StrategyBreakdown, ConvictionHeatmap, CommunityTimeline, etc. |

---

## Testing

```bash
npm run test:coverage
```

Coverage target: 80%+ on all `lib/` files. Strategies, portfolio math, orchestrator, market clients, and community aggregation are fully unit tested.
