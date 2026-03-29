# AI Trader

A Next.js paper trading simulation where AI and rule-based bots trade real stocks with fake money against live market data — with a **Replay Mode** to test against historical data on weekends or after-hours.

## Overview

- **5 trading bots** — RSI Ranger, Trend Rider (SMA Crossover), Mo Mentum, The Reverser (Mean Reversion), and ARIA (AI/Gemini) — each starting with $100,000
- **Live mode** — streams real-time 1-minute ticks from Alpaca's IEX WebSocket feed
- **Replay mode** — replays any past trading day's 1-minute bars at 1×/5×/10×/50× speed; works on weekends/after-hours with no live feed required
- **Watchlist** — NVDA, AAPL, TSLA, MSFT, AMD tracked simultaneously
- **Leaderboard** tracks each bot's portfolio value, P&L, and trade history in real time

**Stack**: Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · `@google/genai` · Alpaca Markets API

---

## Setup

### Prerequisites

- Node.js 20+
- [Alpaca Markets](https://alpaca.markets/) account (free) — for live market data + paper trading API
- [Google AI Studio](https://aistudio.google.com/) API key — for the ARIA AI bot (optional; other bots work without it)

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

---

## Architecture

```
Alpaca WebSocket ──► StreamManager ──► Orchestrator ──► StateBroadcaster ──► SSE ──► UI
Alpaca REST      ──► ReplayEngine  ──►           ↑
                                       Bot strategies (RSI, SMA, Momentum, MeanReversion, AI)
```

- **`Orchestrator`** — singleton that dispatches ticks to bots, executes orders, updates portfolios
- **`StreamManager`** — wraps the Alpaca WebSocket; emits `tick` events during market hours
- **`ReplayEngine`** — fetches historical bars, sorts them chronologically across tickers, emits identical `tick` events on a timer
- **`StateBroadcaster`** — fans out `SimState` to all connected SSE clients

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

---

## Key files

| File | Purpose |
|------|---------|
| `types/index.ts` | All TypeScript interfaces (`SimState`, `BotState`, `ReplayState`, etc.) |
| `lib/constants.ts` | Watchlist, default bot configs, timing constants |
| `lib/orchestrator.ts` | Core simulation engine — tick dispatch, order execution |
| `lib/market/stream-manager.ts` | Alpaca WebSocket client |
| `lib/market/replay-engine.ts` | Historical bar replay with configurable speed |
| `lib/market/alpaca-rest.ts` | REST client — snapshots, bars, last trading day |
| `lib/portfolio.ts` | Pure portfolio math — buy/sell execution, P&L |
| `lib/strategies/` | RSI, SMA crossover, momentum, mean reversion strategies |
| `lib/bots/ai-bot.ts` | ARIA — Gemini-powered trading bot |
| `app/page.tsx` | Main UI — SSE client, all state |
| `components/SimControls.tsx` | Start/pause/reset + mode toggle + replay speed |

---

## Testing

```bash
npm run test:coverage
```

Coverage target: 80%+ on all `lib/` files. Strategies, portfolio math, orchestrator, and market clients are fully unit tested.
