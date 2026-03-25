# AI Trader — Project Rules

## Project
Next.js + TypeScript single-page app. Four Claude-powered AI trader agents analyze NVDA headlines and produce BUY/SELL/HOLD decisions that drive a simulated price engine.

**Stack**: Next.js (App Router), TypeScript, Tailwind CSS, Recharts, `@google/genai`
**Model**: `gemini-2.0-flash` via Google Gemini API for all agent calls
**Entry points**: `app/page.tsx` (UI), `app/api/analyze/route.ts` (API)

## Next.js
This version may have breaking changes from training data. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

---

## TypeScript Rules

- **No `any`** — use `unknown` for untrusted input, then narrow safely
- **Explicit types on all exported functions** — let TypeScript infer locals
- **`interface` for object shapes**, `type` for unions/intersections/utilities
- **No `React.FC`** — type props with a named interface, use plain function syntax
- **No mutations** — use spread for updates: `return { ...obj, key: value }`
- **No `console.log`** in production code
- **Async/await + try-catch** — catch type is `unknown`, narrow before accessing `.message`

```typescript
// Props
interface AgentCardProps {
  decision: AgentDecision
  isLoading: boolean
}
function AgentCard({ decision, isLoading }: AgentCardProps) { ... }

// Error handling
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : 'Unexpected error'
}
```

---

## Security Rules

- **Never hardcode secrets** — always use environment variables
- **Always guard missing env vars** at startup:

```typescript
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
```

- **Validate all API inputs** at the route boundary (headline: non-empty string ≤500 chars, currentPrice: positive number)
- **Return 400 on bad input**, 500 on unexpected errors — never leak stack traces to the client

---

## Testing Rules

- **TDD**: write tests before implementation (Red → Green → Refactor)
- **80%+ coverage** on all `lib/` files
- **Pure functions first**: `lib/price-engine.ts` must be fully unit tested with zero mocks
- **E2E**: use Playwright for critical user flows (submit headline → agent cards populate → price updates)
- Use **`e2e-runner`** agent for Playwright tests

---

## Workflow Rules

- **Plan before coding**: check `tasks/todo.md` and mark items as you complete them
- **Verify before done**: run `npm run build` after each phase; never mark complete without proof
- **Simplicity first**: touch only what's necessary; no speculative abstractions
- **After any correction**: update `tasks/lessons.md` with the pattern to avoid repeating it

## Git & Commit Rules

**Always run before any commit:**
```
npm run build && npm run lint
```
Never commit if build or lint fails.

**Commit often within a phase** — each logical unit of work gets its own commit. Do not batch an entire phase into one commit. Examples of commit boundaries within Phase 1:
- After creating `types/index.ts`
- After creating `lib/constants.ts`
- After implementing `lib/price-engine.ts`
- After writing tests for the price engine

This allows reverting individual features without losing surrounding work.

**Commit message format:**
```
<type>: <description>
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Commands:**
- `/commit` — stage + commit only
- `/commit-push-pr` — stage + commit + push + open GitHub PR

---

## Agent Usage

| When | Use |
|------|-----|
| Writing new code | `tdd-guide` agent → write tests first |
| After writing code | `code-reviewer` + `typescript-reviewer` agents (run in parallel) |
| Touching API route or env vars | `security-reviewer` agent |
| Build fails | `build-error-resolver` agent |
| Final E2E verification | `e2e-runner` agent |
| Looking up Gemini SDK | `docs-lookup` agent or `everything-claude-code:docs` skill |
| UI component structure | `everything-claude-code:frontend-patterns` skill |

## Impeccable — UI Design Skills

**One-time setup (run before starting Phase 4):**
```
/teach-impeccable
```
This interviews you about brand, aesthetic, and tone, then writes `.impeccable.md` with persistent design context. All subsequent impeccable skills read this file automatically.

**Per-component (after each component is built):**

| Moment | Skill |
|--------|-------|
| After building component structure | `impeccable:arrange` — layout, spacing, visual hierarchy |
| After all 4 AgentCards exist | `impeccable:colorize` — BUY/SELL/HOLD color strategy, conviction bar |
| After AgentCard + DecisionLog copy | `impeccable:clarify` — labels, empty states, error messages |
| After all components built | `impeccable:typeset` — typography consistency across cards, chart, log |
| Phase 5 — card fade-in animations | `impeccable:animate` — motion design for results appearing |
| Phase 5 — final pass | `impeccable:polish` — overall quality before shipping |

**Optional / situational:**

| Situation | Skill |
|-----------|-------|
| Design feels too safe or bland | `impeccable:bolder` |
| Design feels too loud or busy | `impeccable:quieter` |
| Want a design critique before polishing | `impeccable:critique` |
| Dark mode support (Phase 5) | `impeccable:adapt` |

---

## Key Files

| File | Purpose |
|------|---------|
| `types/index.ts` | All TypeScript interfaces |
| `lib/constants.ts` | Config: starting price, model ID, clamp values |
| `lib/price-engine.ts` | Pure `calculateNewPrice()` — no side effects |
| `lib/agents.ts` | Trader personalities + Claude SDK calls |
| `app/api/analyze/route.ts` | POST endpoint — input validation + orchestration |
| `app/page.tsx` | Main UI — all state lives here |
| `tasks/todo.md` | Implementation plan with phase checkboxes |
