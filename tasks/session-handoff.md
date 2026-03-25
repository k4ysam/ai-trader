# Session Handoff — ai-trader

## Current state (as of last commit)
- **Branch**: main
- **Build**: ✅ passing
- **Tests**: 99/99 passing
- **Last commit**: `85fb82c feat: overhaul UI with efferd/hero-3 aesthetic`

## What the app is
Next.js 16 + TypeScript SPA. User types an NVDA stock headline → 4 Gemini AI trader agents (Marcus/momentum, Vera/contrarian, Dr. Reeves/fundamental, Eddie/panic) each independently return BUY/SELL/HOLD → conviction-weighted price engine simulates a price move → UI updates live.

**Stack**: Next.js App Router, Tailwind CSS, Recharts, `@google/genai` SDK
**API key needed**: `GEMINI_API_KEY` in `.env.local`
**Run**: `npm run dev` → http://localhost:3000
**Test**: `npm test`
**Build**: `npm run build`

## Key files
| File | Purpose |
|------|---------|
| `app/page.tsx` | Main UI — all state lives here |
| `app/api/analyze/route.ts` | POST /api/analyze — orchestrates agents + price engine |
| `lib/agents.ts` | Gemini SDK calls, sequential 300ms-staggered, retry built-in |
| `lib/personalities.ts` | 4 trader system prompts (no SDK dependency) |
| `lib/price-engine.ts` | Pure conviction-weighted price calculator |
| `lib/constants.ts` | MODEL_ID, STARTING_PRICE, AGENT_COLORS |
| `tasks/todo.md` | Full phase checklist |

## What's working
- All 4 phases complete and committed
- Gemini rate limit workarounds: sequential calls (300ms gap) + built-in 5× retry + user-friendly error messages
- UI has hero-3 aesthetic: scanline skeletons, glow borders, area chart, dot-grid background

## What needs debugging / next steps
The user is hitting **runtime errors** that need investigation. To debug:
1. `npm run dev` and open browser DevTools console
2. Check `app/api/analyze/route.ts` for server-side errors (Next.js terminal output)
3. Run `npm test` to confirm unit tests still pass
4. Check `.env.local` has `GEMINI_API_KEY=<valid key>`

Likely error sources:
- `AGENT_COLORS` imported in `AgentCard.tsx` from `lib/constants.ts` — verify the export exists
- `ThinkingSkeleton` component references `TRADER_PERSONALITIES` from `lib/personalities.ts` — verify import
- New UI classes (`panel-depth`, `glass-panel`, `animate-borderGlow`, etc.) defined in `app/globals.css`

## Recent UI changes (user-applied, not yet committed cleanly)
The user applied a major visual overhaul. Files changed:
- `app/globals.css` — added many keyframes and utility classes
- `app/page.tsx` — hero-3 layout with gradient blobs
- `components/AgentCard.tsx` — ThinkingSkeleton with waveform/scanline, AGENT_COLORS
- `components/AgentPanel.tsx` — fadeDelay prop per card
- `components/PriceChart.tsx` — AreaChart with pulsing dot, green/red gradient
- `components/DecisionLog.tsx` — panel-depth styling
- `lib/constants.ts` — added `AGENT_COLORS` and `AgentColorConfig`

These changes are committed in `85fb82c`.
