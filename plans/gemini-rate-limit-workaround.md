# Blueprint: Gemini Rate Limit Workaround

**Objective**: Prevent 429 RESOURCE_EXHAUSTED errors when 4 parallel Gemini agent calls are made per user request.

**Status**: Ready to execute
**Branch**: direct mode (edit-in-place)

---

## Research Summary

| Free Tier Limits | Value |
|---|---|
| Requests per minute (RPM) | **5 RPM** |
| Requests per day (RPD) | 100 RPD |
| Tokens per minute (TPM) | 250,000 TPM |

**Root cause**: 4 simultaneous calls consumes 80% of the free tier's 5 RPM budget in a single shot. Any second request within the same minute hits the limit.

**Additional finding**: `gemini-2.0-flash` is deprecated (June 2026 shutdown). Replacement is `gemini-2.5-flash`.

**Best path**: Migrate from `@google/generative-ai` → `@google/genai` (new official SDK). It has **built-in exponential backoff + jitter** on 429/500/503, eliminating the need for a separate retry library.

---

## Step Plan

### Step 1 — Migrate to `@google/genai` and upgrade model (SERIAL, blocks Step 2)

**Context**: The project currently uses the deprecated `@google/generative-ai` SDK (will be shut down alongside `gemini-2.0-flash` in June 2026). The new `@google/genai` SDK has built-in retry.

**Files touched**:
- `package.json` / `package-lock.json`
- `lib/agents.ts`
- `lib/agents.test.ts`
- `lib/constants.ts`

**Tasks**:
1. `npm uninstall @google/generative-ai && npm install @google/genai`
2. Update `lib/constants.ts`: `MODEL_ID = "gemini-2.5-flash"`
3. Rewrite `lib/agents.ts` SDK section:
   ```typescript
   import { GoogleGenAI } from "@google/genai";

   // Inside callAgent():
   const ai = new GoogleGenAI({
     apiKey: process.env.GEMINI_API_KEY!,
     httpOptions: { retryOptions: { attempts: 5 }, timeout: 120_000 },
   });
   const model = ai.models;
   const result = await model.generateContent({
     model: MODEL_ID,
     config: {
       systemInstruction: personality.systemPrompt,
       maxOutputTokens: 512,
       temperature: 0.7,
     },
     contents: [{ role: "user", parts: [{ text: userMessage }] }],
   });
   const text = result.text ?? "";
   ```
4. Update `lib/agents.test.ts` mock to match new SDK API surface:
   - Mock module: `@google/genai`
   - Chain: `new GoogleGenAI(opts)` → `.models.generateContent(req)` → `{ text: string }`
   - `vi.stubEnv("GEMINI_API_KEY", "test-key")` stays the same
5. Run `npm test` — all 98 tests must pass

**Verification**:
```bash
npm test
npm run build
```

**Exit criteria**: Build green, 98+ tests pass, no references to `@google/generative-ai` remain.

---

### Step 2 — Add sequential staggering for free-tier safety (SERIAL, after Step 1)

**Context**: Even with retry, hammering 4 simultaneous calls is wasteful on the free tier (5 RPM). Staggering calls 300ms apart keeps us under the burst limit and reduces retries.

**Strategy**: Replace `Promise.allSettled` fan-out with a sequential map that inserts a small delay between each call. On Tier 1+ (150+ RPM) this is imperceptible (1.2s overhead). On free tier it prevents most 429s before they happen.

**Files touched**:
- `lib/agents.ts`

**Tasks**:
1. Replace the `Promise.allSettled` in `analyzeHeadline` with a sequential loop:
   ```typescript
   const INTER_CALL_DELAY_MS = 300; // 300ms between calls = ~3.3 calls/s, safe for free tier

   export async function analyzeHeadline(
     headline: string,
     currentPrice: number,
   ): Promise<{ decisions: AgentDecision[]; partialFailure: boolean }> {
     const decisions: AgentDecision[] = [];
     for (const [i, p] of TRADER_PERSONALITIES.entries()) {
       if (i > 0) await new Promise(r => setTimeout(r, INTER_CALL_DELAY_MS));
       decisions.push(await callAgent(p, headline, currentPrice));
     }
     const partialFailure = decisions.some((d) => d.error != null);
     return { decisions, partialFailure };
   }
   ```
2. Note: `callAgent` already catches all errors and returns them in the `error` field — no `try/catch` needed around the loop.

**Verification**:
```bash
npm test
npm run build
```

**Exit criteria**: `analyzeHeadline` test group still passes (6 tests). Build green.

---

### Step 3 — Surface rate limit errors distinctly in the UI (SERIAL, after Step 2)

**Context**: When Gemini returns a 429 even after retries (e.g., RPD exhausted), the current UI shows a generic agent `error` field. Users need a clear message.

**Files touched**:
- `lib/agents.ts` — detect RESOURCE_EXHAUSTED in catch block
- `app/page.tsx` — check if all 4 agents failed with rate limit errors

**Tasks**:
1. In `callAgent` catch block, check if the error message contains `RESOURCE_EXHAUSTED` or `429` and set a user-friendly message:
   ```typescript
   } catch (error: unknown) {
     const rawMsg = error instanceof Error ? error.message : "Unexpected error";
     const isRateLimit = rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("429");
     const msg = isRateLimit
       ? "Rate limit reached — please wait a moment and try again"
       : rawMsg;
     return { traderName: ..., ..., error: msg };
   }
   ```
2. In `app/page.tsx`, after receiving decisions, check if all 4 have `error` containing "Rate limit":
   ```typescript
   const allRateLimited = decisions.every(
     (d) => d.error?.includes("Rate limit")
   );
   if (allRateLimited) {
     setError("Gemini rate limit reached. Please wait 15–60 seconds and try again.");
     return;
   }
   ```

**Verification**:
```bash
npm test
npm run build
```

**Exit criteria**: Build green, tests pass.

---

## Dependency Graph

```
Step 1 (SDK migration) ──→ Step 2 (sequential calls) ──→ Step 3 (UI error)
```

All steps are serial. No parallelism opportunity since each step modifies `lib/agents.ts`.

---

## Rollback

Each step is a separate commit. To revert to parallel Anthropic SDK:
```bash
git revert HEAD~N  # N = number of steps to undo
```

---

## Success Criteria

- [ ] `@google/generative-ai` fully removed
- [ ] `@google/genai` with built-in retry installed
- [ ] Model updated to `gemini-2.5-flash`
- [ ] Calls are staggered (no more 4-simultaneous burst)
- [ ] Rate limit errors surface a readable message instead of a raw API error
- [ ] All tests pass, build is green
