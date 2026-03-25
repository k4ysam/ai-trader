# AI Trader

A Next.js single-page app where four AI trader agents analyze NVDA headlines and produce BUY/SELL/HOLD decisions that drive a simulated price engine.

## Overview

- **Four AI agents** with distinct trader personalities call the Gemini API and independently analyze each headline
- **Price engine** aggregates agent decisions (weighted by conviction) to move a simulated NVDA price
- **Live chart** tracks price history; a decision log records every agent call

**Stack**: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Recharts · `@google/genai`

---

## Setup

### Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com/) API key

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local and set GEMINI_API_KEY
```

<!-- AUTO-GENERATED -->
### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key used by all four trader agents |
<!-- /AUTO-GENERATED -->

---

## Commands

<!-- AUTO-GENERATED -->
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build with type checking |
| `npm start` | Start production server (requires build first) |
| `npm test` | Run test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
<!-- /AUTO-GENERATED -->

---

## API

### `POST /api/analyze`

Runs all four trader agents against the given headline and returns their decisions plus the updated price.

**Request body**
```json
{
  "headline": "NVDA beats earnings estimates by 20%",
  "currentPrice": 875.50
}
```

**Response**
```json
{
  "decisions": [
    { "agentId": "momentum", "action": "BUY", "conviction": 0.85, "reasoning": "..." },
    ...
  ],
  "priceResult": { "newPrice": 912.30, "delta": 36.80, "deltaPercent": 4.21 },
  "partialFailure": false
}
```

**Error codes**
| Status | Meaning |
|--------|---------|
| 400 | Invalid input (missing/bad headline or currentPrice) |
| 429 | Rate limit exceeded (20 req/min per IP) |
| 500 | Internal server error |

---

## Key files

| File | Purpose |
|------|---------|
| `types/index.ts` | All TypeScript interfaces |
| `lib/constants.ts` | Config: starting price, model ID, clamp values |
| `lib/price-engine.ts` | Pure `calculateNewPrice()` — no side effects |
| `lib/agents.ts` | Trader personalities + Gemini SDK calls |
| `app/api/analyze/route.ts` | POST endpoint — input validation + orchestration |
| `app/page.tsx` | Main UI — all state lives here |

---

## Testing

```bash
npm run test:coverage
```

Coverage target: 80%+ on all `lib/` files.
