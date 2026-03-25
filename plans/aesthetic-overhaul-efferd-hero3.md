# Blueprint: Copy efferd/hero-3 Aesthetic into AI Trader Arena

**Objective:** Replicate the full visual aesthetic of the 21st.dev `efferd/hero-3` component across the AI Trader app — ambient radial gradient blobs, staggered `slide-in-from-bottom` entrance animations, deep panel shadows with inset highlights, pill badge branding, and blur overlay depth.

**Reference component source:**
```tsx
// Key patterns extracted from hero-3:
// 1. Ambient radial blobs: bg-[radial-gradient(ellipse_at_center,...)] blur-[50px]
// 2. Entrance: fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-[n] duration-500
// 3. Panel depth: inset-shadow-foreground/10 ring-1 ring-card shadow-xl rounded-lg
// 4. Header badge: rounded-sm border bg-card p-1 shadow-xs font-mono text-xs
// 5. mask-b-from-60% for fading elements into background
```

**Mode:** Direct (edit-in-place, no branches — uncommitted changes already on main)

**Dependency graph:**
```
Step 1 (CSS foundation)
  ├── Step 2 (ambient blobs + page layout)
  ├── Step 3 (header badge + entrance animations) depends on Step 1
  ├── Step 4 (panel depth: cards, chart, log) depends on Step 1
  └── Step 5 (final polish: blur overlays, mask, reduced-motion) depends on Steps 2–4
```

**Parallelism:** Steps 2, 3, 4 can execute in parallel after Step 1.

---

## Step 1 — CSS Foundation: slide-in + fill-mode utilities

**Context brief:**
The hero-3 component uses `tailwindcss-animate` utilities (`animate-in`, `fade-in`, `slide-in-from-bottom-*`, `fill-mode-backwards`, staggered `delay-*`). The project uses Tailwind v4 (`@import "tailwindcss"` in globals.css). Rather than adding a third-party plugin with uncertain v4 compatibility, replicate the needed keyframes and utilities manually in `app/globals.css`.

**Files to modify:**
- `app/globals.css`

**Task list:**
- [ ] Add `@keyframes slideInFromBottom` with CSS variable `--slide-distance` (default `20px`) for easy per-element tuning
- [ ] Add `.animate-in` utility: `animation: slideInFromBottom var(--duration, 0.5s) ease-out var(--delay, 0ms) both`
- [ ] Add `.fade-in` modifier: sets `--slide-distance: 0px` (opacity only, no translate)
- [ ] Add `.slide-in-from-bottom-5` modifier: `--slide-distance: 20px`
- [ ] Add `.slide-in-from-bottom-10` modifier: `--slide-distance: 40px`
- [ ] Add `.fill-mode-backwards` modifier: sets `animation-fill-mode: backwards`
- [ ] Add delay utilities: `.delay-100`, `.delay-200`, `.delay-300`, `.delay-500`, `.delay-700`, `.delay-1000` — each sets `--delay: Nms`
- [ ] Add duration utilities: `.duration-500`, `.duration-700`, `.duration-1000`
- [ ] Extend existing `@media (prefers-reduced-motion: reduce)` block to also disable `.animate-in`

**Verification:**
```bash
npm run build
# Must: compiled successfully, no TypeScript errors
```

**Exit criteria:** `globals.css` compiles, `.animate-in` + `.slide-in-from-bottom-10` + `.fill-mode-backwards` + `.delay-500` can be combined on any element.

---

## Step 2 — Ambient Radial Gradient Blobs (page.tsx)

**Context brief:**
hero-3's most distinctive feature: large blurred radial gradient blobs that create ambient colored lighting in the background. Two blobs: one top-center (subtle foreground tint) and one mid-page (larger ellipse behind the content panel). These sit at `z-0` with content at `z-10`.

The app's `<main>` is currently `bg-zinc-950 dot-grid-bg`. The blobs sit *behind* the dot-grid overlay as `aria-hidden` decorative divs with `absolute inset-0` and `-z-10`.

**Files to modify:**
- `app/page.tsx`

**Task list:**
- [ ] Add `relative overflow-hidden` to the `<main>` element (needed for `absolute` blob positioning)
- [ ] Inside `<main>` as the *first* child, add `aria-hidden="true"` blob container:
  ```tsx
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
    {/* Top-center blob — subtle blue glow */}
    <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full
                    bg-[radial-gradient(ellipse_at_center,#3b82f620,transparent_70%)]
                    blur-[60px]" />
    {/* Mid-left blob — purple accent */}
    <div className="absolute top-1/3 -left-20 w-[500px] h-[500px] rounded-full
                    bg-[radial-gradient(ellipse_at_center,#a855f715,transparent_70%)]
                    blur-[80px]" />
    {/* Bottom-right blob — emerald */}
    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full
                    bg-[radial-gradient(ellipse_at_center,#10b98112,transparent_70%)]
                    blur-[80px]" />
  </div>
  ```
- [ ] Verify the blobs don't clip content — `overflow-hidden` on `<main>`, blobs use `absolute` not `fixed`

**Verification:**
```bash
npm run build && npm run dev
# Visual: soft colored ambient lighting visible behind the dot-grid
# No content clipping or layout shift
```

**Exit criteria:** Three subtle colored glows visible in background; content fully unobstructed.

---

## Step 3 — Header Badge + Staggered Entrance Animations (page.tsx)

**Context brief:**
hero-3's header uses a pill badge (`rounded-sm border bg-card p-1 font-mono text-xs`) with an icon and animated arrow. Every content section stagger-animates in from below using `fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-[n]`.

Apply to AI Trader: transform the header into a badge + title combo that slides in, then animate each major page section with increasing delays.

**Files to modify:**
- `app/page.tsx`

**Task list:**
- [ ] Replace the plain `<h1>` header block with:
  ```tsx
  {/* Badge */}
  <div className="animate-in slide-in-from-bottom-10 fill-mode-backwards delay-100 duration-500
                  flex w-fit items-center gap-2 rounded-sm border border-zinc-800
                  bg-zinc-900/80 px-2 py-1 shadow-sm backdrop-blur-sm mb-3">
    <span className="font-mono text-xs text-zinc-400 border border-zinc-700 rounded-xs px-1.5 py-0.5 bg-zinc-950">
      LIVE
    </span>
    <span className="text-xs text-zinc-400">AI-powered NVDA trading simulation</span>
    <span className="block h-3 border-l border-zinc-700" />
    <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </div>
  {/* Title */}
  <h1 className="animate-in slide-in-from-bottom-10 fill-mode-backwards delay-200 duration-500
                 text-2xl font-bold tracking-tight
                 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
    AI Trader Arena
  </h1>
  <p className="animate-in slide-in-from-bottom-10 fill-mode-backwards delay-300 duration-500
                text-sm text-zinc-500 mt-1">
    Submit a {STOCK_TICKER} headline and watch four AI traders react
  </p>
  ```
- [ ] Add `animate-in slide-in-from-bottom-5 fill-mode-backwards delay-300 duration-700` to the `<HeadlineInput>` wrapper div
- [ ] Add `animate-in slide-in-from-bottom-5 fill-mode-backwards delay-500 duration-700` to the `<AgentPanel>` wrapper div
- [ ] Add `animate-in slide-in-from-bottom-5 fill-mode-backwards delay-700 duration-1000` to the chart/log grid div

**Verification:**
```bash
npm run build
# Visual: badge appears first, title slides in, input and panels animate in sequence
```

**Exit criteria:** All major sections stagger-enter on page load in visual sequence matching hero-3 timing.

---

## Step 4 — Panel Depth: Cards, Chart, Log (AgentCard + PriceChart + DecisionLog)

**Context brief:**
hero-3's content panels use `inset-shadow-foreground/10 ring-1 ring-card shadow-xl rounded-lg` for depth. CSS `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06)` creates a top highlight that makes dark panels feel three-dimensional. Apply this treatment to every card and panel.

**Files to modify:**
- `components/AgentCard.tsx`
- `components/PriceChart.tsx`
- `components/DecisionLog.tsx`
- `components/AgentPanel.tsx` (empty state)

**Task list:**

### AgentCard.tsx
- [ ] On the resolved card `<div>`, replace `border border-zinc-800` with `border border-zinc-800/60 ring-1 ring-white/5 shadow-xl`
- [ ] Add `style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), ...' }}` or add it as a CSS custom class `.panel-depth` in globals.css
- [ ] On `ThinkingSkeleton`, apply same `ring-1 ring-white/5 shadow-xl` treatment

### PriceChart.tsx
- [ ] On the outer `<div>`, replace `border border-zinc-800` with `border border-zinc-800/60 ring-1 ring-white/5 shadow-xl`
- [ ] Add the `panel-depth` class (top inset highlight)

### DecisionLog.tsx
- [ ] Read the file first, then apply same `ring-1 ring-white/5 shadow-xl panel-depth` to the container

### AgentPanel.tsx
- [ ] On the empty state div, apply the same panel style

### globals.css
- [ ] Add `.panel-depth` utility:
  ```css
  .panel-depth {
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5),
                0 8px 10px -6px rgba(0,0,0,0.4),
                inset 0 1px 0 rgba(255,255,255,0.05);
  }
  ```

**Verification:**
```bash
npm run build
# Visual: cards appear to float off the background with depth and a subtle top-edge highlight
```

**Exit criteria:** All panels have `ring-1 ring-white/5` + `panel-depth` shadow applied.

---

## Step 5 — Final Polish: Blur + Mask + Backdrop (page.tsx + globals.css)

**Context brief:**
hero-3's final signature elements: `backdrop-blur-sm` on floating elements, `mask-b-from-60%` to fade bottom edges into the background, and blur overlays on key sections. These make the overall composition feel layered and premium.

**Files to modify:**
- `app/globals.css`
- `app/page.tsx`
- `components/PriceChart.tsx`

**Task list:**

### globals.css
- [ ] Add `.mask-fade-bottom` utility:
  ```css
  .mask-fade-bottom {
    -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  }
  ```
- [ ] Add `.glass-panel` utility (for floating overlays like the price ticker):
  ```css
  .glass-panel {
    background: rgba(9, 9, 11, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  ```

### page.tsx
- [ ] Wrap `<PriceTicker>` in a `glass-panel rounded-xl px-4 py-2 border border-zinc-800/60` div so it appears as a floating badge

### PriceChart.tsx
- [ ] Add `mask-fade-bottom` to the chart container (the bottom of the chart softly fades out, matching hero-3's image treatment)

### Error/banner divs (page.tsx)
- [ ] Add `backdrop-blur-sm` to the error and partial-failure banner divs for consistency

**Verification:**
```bash
npm run build
# Visual: price ticker appears as a frosted glass pill; chart bottom fades out; banners have blur
```

**Exit criteria:** All glass/blur effects render without layout issues; `npm run build` passes with zero errors.

---

## Invariants (enforced after every step)

1. `npm run build` — zero TypeScript errors, zero compilation failures
2. No new npm packages — all effects via CSS + Tailwind utility classes only
3. No `any` types introduced
4. `@media (prefers-reduced-motion)` block disables all new animations
5. No content is hidden or clipped on mobile (320px viewport minimum)

---

## Rollback per step

Each step only modifies CSS classes/Tailwind strings — no logic changes. Any step can be reverted with `git checkout -- <file>` without affecting other steps.

---

## Success criteria (full completion)

- [ ] Ambient radial gradient blobs visible in background
- [ ] `LIVE` pill badge appears above header with arrow icon
- [ ] Every major page section slides in from bottom on load with staggered timing
- [ ] All cards/panels have `ring-1 ring-white/5 shadow-xl panel-depth` depth treatment
- [ ] Price ticker renders as a frosted glass floating badge
- [ ] Chart bottom edge fades via mask
- [ ] `npm run build` passes cleanly after all steps
- [ ] All animations disabled under `prefers-reduced-motion: reduce`
