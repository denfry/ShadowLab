# Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ShadowLab / Denfry Games **portal** (site shell + portal pages) to a polished cinematic neon-cyberpunk look, without changing any in-game UI.

**Architecture:** Presentation-layer refresh on the existing React + Vite + Tailwind + CSS-variable stack. Design decisions live in (a) the **portal** token block + Tailwind theme + `global.css` ambience, and (b) portal components/pages. Logic-bearing pieces (card view-model, home "continue" selection, genre filter, motion gate) are extracted into **pure functions** unit-tested with the existing vitest setup; purely-visual changes are verified by typecheck + build + render smoke + a manual visual checklist that includes confirming the games look unchanged.

**Tech Stack:** React 18, Vite 5, TypeScript 5.5, TailwindCSS 3.4 (+ CSS variables), Zustand 4, framer-motion 11, vitest 2 (pure-logic tests; no jsdom/RTL — do **not** add them).

## Global Constraints

- **Do NOT touch `src/games/**`** (ColonyHud, ShadowTraceGame, FakeTerminal, ConnectionBoard, WorldScene, definitions, domain, systems). Verified visually unchanged at the end.
- **Do NOT change the `[data-theme='colony']` and `[data-theme='shadow']` blocks** in `src/styles/tokens.css` (byte-for-byte identical — in-game palettes must not shift).
- **Do NOT redesign `src/pages/games/CaseBrowser.tsx`** (game-adjacent; inherits primitive/token polish passively only).
- **Primitive changes are additive:** keep existing `Button` variants `primary | ghost | danger | subtle` visually as-is (games depend on them); only ADD a `solid` variant. Same spirit for `Modal` / `ProgressBar` — preserve API and existing look; any unavoidable change is verified in both game themes.
- **Neon text-glow budget:** `neon-text` only on hero + page/game titles. Remove it from secondary headings/card bodies.
- **No new runtime dependencies.** No jsdom, no React Testing Library. Tests are pure-logic vitest.
- **Fonts unchanged:** Chakra Petch (display), IBM Plex Mono (mono), IBM Plex Sans (sans).
- **Keep cyan `--accent: 0 229 255` and magenta `--accent-2: 255 45 126`.**
- Spec of record: `docs/superpowers/specs/2026-06-18-portal-redesign-design.md`.

---

## File Structure

**Created**
- `src/ui/motion.ts` — pure `motionAllowed(prefersReduced, settingReduced)`.
- `src/ui/hooks/useMotionAllowed.ts` — hook wrapping the pure fn + media query + settings store.
- `src/ui/primitives/StatChip.tsx` — themed mono label/value chip.
- `src/ui/primitives/Tag.tsx` — small mono tag (genre/case).
- `src/ui/feedback/Skeleton.tsx` — shimmer loading block (reduced-motion aware).
- `src/ui/game/gameCardModel.ts` — pure `buildGameCardModel(input)` view-model.
- `src/pages/home/continueModel.ts` — pure `pickContinue(games, lastSaveOf)`.
- `src/pages/games/genreFilter.ts` — pure `availableGenres` / `filterByGenre`.
- `src/ui/home/ContinueHero.tsx` — resume-first hero / spotlight.
- Tests: `tests/ui/gameCardModel.test.ts`, `tests/ui/continueModel.test.ts`, `tests/ui/genreFilter.test.ts`, `tests/ui/motion.test.ts`.

**Modified**
- `src/styles/tokens.css` (portal block only) · `src/styles/global.css` · `tailwind.config.ts`
- `src/ui/primitives/Button.tsx` · `src/ui/primitives/SectionTitle.tsx` · `src/ui/primitives/Modal.tsx` · `src/ui/primitives/ProgressBar.tsx`
- `src/ui/layout/Header.tsx` · `src/ui/layout/Sidebar.tsx` · `src/ui/layout/AppLayout.tsx`
- `src/ui/game/GameCard.tsx` · `src/ui/game/SaveSlotCard.tsx`
- `src/ui/profile/ProfileWidget.tsx` · `src/ui/profile/AchievementBadge.tsx` · `src/ui/feedback/LoadingScreen.tsx`
- `src/app/providers.tsx` (mount motion gate) — or `AppLayout` if providers is unsuitable.
- Pages: `home/HomePage.tsx` · `games/GamesPage.tsx` · `games/GameDetailPage.tsx` · `play/GameLauncherPage.tsx` · `profile/ProfilePage.tsx` · `achievements/AchievementsPage.tsx` · `news/NewsPage.tsx` · `about/AboutPage.tsx` · `settings/SettingsPage.tsx`

**Untouched (guard):** everything under `src/games/`, the colony/shadow token blocks, `CaseBrowser.tsx`, services/stores/domain/save schema/router.

---

## Task 0: Initialize git + baseline

**Files:** repo root.

- [ ] **Step 1: Initialize repo (if not already)**

Run:
```bash
git init && git add -A && git commit -m "chore: baseline before portal redesign"
```
Expected: a first commit containing the current working app. (If git is already initialized, just commit any pending state.)

- [ ] **Step 2: Confirm green baseline**

Run:
```bash
npm run typecheck && npm run test && npm run build
```
Expected: typecheck clean, **9 passed** (3 files), build succeeds. This is the reference state the redesign must preserve.

---

## Task 1: Foundation — portal tokens, Tailwind theme, ambience, type scale

**Files:**
- Modify: `src/styles/tokens.css` (only `:root, [data-theme='portal']` block)
- Modify: `tailwind.config.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: Tailwind shadow utilities `shadow-e1`, `shadow-e2`, `shadow-e3`, `shadow-glow`, `shadow-glow-2`; `animate-shimmer`, `animate-drift`; `.panel`, `.panel-glass`, `.panel-inset`, `.chip`, `.label-mono`, `.scanlines`, `.neon-text`, `.hero-surface` component classes; portal palette values below. Consumed by every later task.

- [ ] **Step 1: Update the portal token block** in `src/styles/tokens.css`. Replace **only** the `:root, [data-theme='portal']` block (leave colony/shadow blocks untouched):

```css
:root,
[data-theme='portal'] {
  --bg: 8 11 20;
  --bg-2: 5 7 14;
  --panel: 16 21 38;
  --panel-2: 22 29 50;
  --edge: 40 54 92;
  --ink: 233 239 248;
  --muted: 132 146 176;
  --accent: 0 229 255; /* cyan */
  --accent-2: 255 45 126; /* magenta */
  --good: 52 211 153;
  --warn: 251 191 36;
  --bad: 248 113 113;
}
```

- [ ] **Step 2: Extend Tailwind theme** in `tailwind.config.ts`. Replace the `boxShadow`, `keyframes`, and `animation` maps inside `extend` with:

```ts
boxShadow: {
  e1: '0 1px 0 rgb(255 255 255 / 0.03), 0 12px 30px -18px rgb(0 0 0 / 0.85)',
  e2: '0 0 0 1px rgb(var(--accent) / 0.18), 0 0 28px -12px rgb(var(--accent) / 0.55), 0 18px 40px -26px rgb(0 0 0 / 0.85)',
  e3: 'inset 0 1px 0 rgb(255 255 255 / 0.05), 0 0 60px -22px rgb(var(--accent) / 0.6), 0 30px 60px -30px rgb(0 0 0 / 0.9)',
  glow: '0 0 0 1px rgb(var(--accent) / 0.35), 0 0 30px -6px rgb(var(--accent) / 0.55)',
  'glow-2': '0 0 0 1px rgb(var(--accent-2) / 0.35), 0 0 30px -6px rgb(var(--accent-2) / 0.55)',
  panel: '0 18px 50px -25px rgb(0 0 0 / 0.8)',
},
backgroundImage: {
  'grid-faint':
    'linear-gradient(rgb(var(--edge) / 0.25) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--edge) / 0.25) 1px, transparent 1px)',
},
keyframes: {
  'fade-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
  'pulse-glow': { '0%, 100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
  scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
  float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
  shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
  drift: { '0%, 100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(2%, -2%, 0)' } },
},
animation: {
  'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
  'pulse-glow': 'pulse-glow 3.5s ease-in-out infinite',
  scan: 'scan 6s linear infinite',
  float: 'float 6s ease-in-out infinite',
  shimmer: 'shimmer 1.6s linear infinite',
  drift: 'drift 18s ease-in-out infinite',
},
```
(Keep the existing `colors` and `fontFamily` maps unchanged.)

- [ ] **Step 3: Refine ambience + component layer** in `src/styles/global.css`. In `@layer base`, update `body::before` (calmer, atmospheric) and `body::after` (quieter grain):

```css
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -2;
    pointer-events: none;
    background:
      radial-gradient(55% 45% at 12% -5%, rgb(var(--accent) / 0.18), transparent 70%),
      radial-gradient(50% 42% at 100% 0%, rgb(var(--accent-2) / 0.15), transparent 70%),
      radial-gradient(90% 70% at 50% 130%, rgb(var(--accent) / 0.06), transparent 70%),
      radial-gradient(120% 120% at 50% 50%, transparent 60%, rgb(0 0 0 / 0.5));
    transition: background 0.5s ease;
  }
  body::after { opacity: 0.25; } /* keep the existing grain rule, lower opacity */
```
Then in `@layer components`, add a glass panel and a hero surface alongside the existing `.panel`:

```css
  .panel-glass {
    @apply rounded-2xl border border-edge/60 bg-panel/70 backdrop-blur-md shadow-e1;
  }
  .hero-surface {
    @apply relative overflow-hidden rounded-3xl border border-edge/60 bg-panel/40 shadow-e3;
  }
```
Keep `.panel`, `.panel-inset`, `.chip`, `.label-mono`, `.scanlines`, `.neon-text` as-is. (`.panel` may add `shadow-e1`.)

- [ ] **Step 4: Verify build + visual smoke**

Run:
```bash
npm run typecheck && npm run build
```
Expected: both succeed. Then `npm run dev`, open the app: portal pages render with deeper background + calmer glow; **open Colony and Shadow Trace detail pages and confirm their themed surfaces are unchanged** (colony/shadow tokens untouched).

- [ ] **Step 5: Commit**
```bash
git add src/styles/tokens.css tailwind.config.ts src/styles/global.css
git commit -m "feat(ui): refine portal tokens, elevation shadows, ambience"
```

---

## Task 2: Motion gate (pure fn + hook + wiring)

**Files:**
- Create: `src/ui/motion.ts`
- Create: `src/ui/hooks/useMotionAllowed.ts`
- Create: `tests/ui/motion.test.ts`
- Modify: `src/ui/layout/AppLayout.tsx` (set root attribute)
- Modify: `src/styles/global.css` (honor the attribute)

**Interfaces:**
- Produces: `motionAllowed(prefersReduced: boolean, settingReduced: boolean): boolean`; hook `useMotionAllowed(): boolean`; root attribute `data-reduced-motion="true"` when motion is disabled; CSS that neutralizes ambient animation under that attribute.

- [ ] **Step 1: Write the failing test** — `tests/ui/motion.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { motionAllowed } from '@/ui/motion';

describe('motionAllowed', () => {
  it('allows motion when neither reduced source is set', () => {
    expect(motionAllowed(false, false)).toBe(true);
  });
  it('blocks motion when OS prefers reduced', () => {
    expect(motionAllowed(true, false)).toBe(false);
  });
  it('blocks motion when the in-app setting is on', () => {
    expect(motionAllowed(false, true)).toBe(false);
  });
  it('blocks motion when both are set', () => {
    expect(motionAllowed(true, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run tests/ui/motion.test.ts`
Expected: FAIL — cannot resolve `@/ui/motion`.

- [ ] **Step 3: Implement** `src/ui/motion.ts`:

```ts
/** Motion is allowed only when neither the OS nor the in-app setting asks to reduce it. */
export function motionAllowed(prefersReduced: boolean, settingReduced: boolean): boolean {
  return !(prefersReduced || settingReduced);
}
```

- [ ] **Step 4: Run it; verify it passes**

Run: `npx vitest run tests/ui/motion.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the hook** — `src/ui/hooks/useMotionAllowed.ts`:

```ts
import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { motionAllowed } from '@/ui/motion';

export function useMotionAllowed(): boolean {
  const settingReduced = useSettingsStore((s) => s.reducedMotion);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return motionAllowed(prefersReduced, settingReduced);
}
```

- [ ] **Step 6: Wire the root attribute** in `src/ui/layout/AppLayout.tsx`. Add inside the component body (before `return`):

```tsx
  const allowMotion = useMotionAllowed();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = allowMotion ? 'false' : 'true';
  }, [allowMotion]);
```
Add imports: `import { useEffect } from 'react';` (merge with existing `useState` import) and `import { useMotionAllowed } from '@/ui/hooks/useMotionAllowed';`.

- [ ] **Step 7: Honor the attribute in CSS** — append to `src/styles/global.css`:

```css
:root[data-reduced-motion='true'] *,
:root[data-reduced-motion='true'] *::before,
:root[data-reduced-motion='true'] *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
```

- [ ] **Step 8: Verify + commit**

Run: `npm run typecheck && npm run build && npx vitest run tests/ui/motion.test.ts`
Expected: all green. Toggle Settings → "Меньше анимаций"; confirm ambient drift/scan stop.
```bash
git add src/ui/motion.ts src/ui/hooks/useMotionAllowed.ts tests/ui/motion.test.ts src/ui/layout/AppLayout.tsx src/styles/global.css
git commit -m "feat(ui): motion gate honoring OS + in-app reduced-motion"
```

---

## Task 3: Primitives — additive Button `solid`, SectionTitle, Modal/ProgressBar polish

**Files:**
- Modify: `src/ui/primitives/Button.tsx`
- Modify: `src/ui/primitives/SectionTitle.tsx`
- Modify: `src/ui/primitives/Modal.tsx`
- Modify: `src/ui/primitives/ProgressBar.tsx`

**Interfaces:**
- Produces: `Button` gains `variant="solid"` (filled gradient CTA) while `primary|ghost|danger|subtle` stay visually identical; `SectionTitle` eyebrow accent-tinted. Consumed by heroes/cards/pages.

- [ ] **Step 1: Add the `solid` variant** in `src/ui/primitives/Button.tsx`. Change the `Variant` type and `variants` map (leave all existing entries unchanged):

```ts
type Variant = 'primary' | 'solid' | 'ghost' | 'danger' | 'subtle';
```
Add to the `variants` record:
```ts
  solid:
    'border border-transparent text-bg shadow-e2 hover:brightness-110 active:translate-y-px ' +
    '[background:linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent)/0.75))]',
```

- [ ] **Step 2: Accent the eyebrow** in `src/ui/primitives/SectionTitle.tsx`. Change the eyebrow line to:

```tsx
        {eyebrow && (
          <p className="mb-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-accent/80">{eyebrow}</p>
        )}
```
(Keep the rest of the component identical.)

- [ ] **Step 3: Polish Modal + ProgressBar (non-breaking).** In `src/ui/primitives/Modal.tsx`, change the dialog container class to use the glass surface (`panel-glass` + `shadow-e3`) but keep all props/structure. In `src/ui/primitives/ProgressBar.tsx`, ensure the fill uses `bg-accent` with a soft `shadow-glow` and the track uses `bg-bg-2`; keep the `value` API. (Read each file first; apply the minimal class change only.)

- [ ] **Step 4: Verify in both game themes**

Run: `npm run typecheck && npm run build`. Then `npm run dev`: open **Settings** (uses Modal + Button danger/ghost/subtle) and the **Colony detail** (ProgressBar via achievements) and **Achievements** page; confirm existing buttons/modals/bars look the same as baseline, and a `solid` button (used later) is available.

- [ ] **Step 5: Commit**
```bash
git add src/ui/primitives/Button.tsx src/ui/primitives/SectionTitle.tsx src/ui/primitives/Modal.tsx src/ui/primitives/ProgressBar.tsx
git commit -m "feat(ui): add solid Button variant; polish SectionTitle/Modal/ProgressBar"
```

---

## Task 4: New primitives — StatChip, Tag, Skeleton

**Files:**
- Create: `src/ui/primitives/StatChip.tsx`
- Create: `src/ui/primitives/Tag.tsx`
- Create: `src/ui/feedback/Skeleton.tsx`

**Interfaces:**
- Produces:
  - `StatChip({ icon?, label, tone? })` where `tone: 'accent'|'accent2'|'good'|'warn'|'muted'` (default `'accent'`).
  - `Tag({ children, tone? })` same tone union (default `'muted'`).
  - `Skeleton({ className? })` shimmer block.
  Consumed by GameCard, ContinueHero, GameDetail, Profile, Achievements, News.

- [ ] **Step 1: Implement `Tag`** — `src/ui/primitives/Tag.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from '@/core/utils';

export type Tone = 'accent' | 'accent2' | 'good' | 'warn' | 'muted';

const toneCls: Record<Tone, string> = {
  accent: 'border-accent/30 bg-accent/10 text-accent',
  accent2: 'border-accent2/30 bg-accent2/10 text-accent2',
  good: 'border-good/30 bg-good/10 text-good',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  muted: 'border-edge/60 bg-panel/50 text-muted',
};

export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em]', toneCls[tone])}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Implement `StatChip`** — `src/ui/primitives/StatChip.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from '@/core/utils';
import type { Tone } from './Tag';

const toneCls: Record<Tone, string> = {
  accent: 'border-accent/25 bg-accent/8 text-accent',
  accent2: 'border-accent2/25 bg-accent2/8 text-accent2',
  good: 'border-good/25 bg-good/8 text-good',
  warn: 'border-warn/25 bg-warn/8 text-warn',
  muted: 'border-edge/60 bg-panel/40 text-muted',
};

export function StatChip({ icon, label, tone = 'accent' }: { icon?: ReactNode; label: string; tone?: Tone }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[0.7rem] tracking-wide', toneCls[tone])}>
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </span>
  );
}
```
(Note: `bg-accent/8` requires Tailwind's arbitrary opacity — if the build rejects `/8`, use `/10`.)

- [ ] **Step 3: Implement `Skeleton`** — `src/ui/feedback/Skeleton.tsx`:

```tsx
import { cx } from '@/core/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-shimmer rounded-lg bg-[length:200%_100%]',
        '[background-image:linear-gradient(90deg,rgb(var(--panel)/0.6),rgb(var(--panel-2)/0.9),rgb(var(--panel)/0.6))]',
        className,
      )}
    />
  );
}
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm run build`. Expected: success (fix `/8`→`/10` if needed).
```bash
git add src/ui/primitives/StatChip.tsx src/ui/primitives/Tag.tsx src/ui/feedback/Skeleton.tsx
git commit -m "feat(ui): add StatChip, Tag, Skeleton primitives"
```

---

## Task 5: Shell — Header

**Files:** Modify: `src/ui/layout/Header.tsx`

- [ ] **Step 1: Restyle the header to glass + refined lockup.** Replace the `<header>` content (keep the `onMenu` prop, the menu button, the `Link to="/"`, and `ProfileWidget`):

```tsx
export function Header({ onMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-edge/60 bg-bg/60 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <button
          className="grid h-10 w-10 place-items-center rounded-xl border border-edge/60 text-muted transition-colors hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 lg:hidden"
          onClick={onMenu}
          aria-label="Меню"
        >
          <IconMenu />
        </button>

        <Link to="/" className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
          <span className="relative grid h-9 w-9 place-items-center">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent to-accent2 opacity-90 shadow-e2 transition-transform group-hover:scale-105" />
            <span className="relative font-display text-base font-bold text-bg">S</span>
          </span>
          <span className="leading-none">
            <span className="block font-display text-sm font-semibold tracking-[0.2em] text-ink">SHADOWLAB</span>
            <span className="block font-mono text-[0.6rem] tracking-[0.3em] text-muted">DENFRY · GAMES</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="chip hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-good" />
            online · local
          </span>
          <ProfileWidget compact />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck && npm run build`. Visually confirm header reads as glass, logo has subtle depth, focus rings work via keyboard Tab.
```bash
git add src/ui/layout/Header.tsx
git commit -m "feat(ui): glassy header with refined logo lockup and focus rings"
```

---

## Task 6: Shell — Sidebar

**Files:** Modify: `src/ui/layout/Sidebar.tsx`

- [ ] **Step 1: Refine nav active state + footer.** Replace the `NavLink` className logic and the footer (keep `NAV_ITEMS` mapping and `onNavigate`):

```tsx
          className={({ isActive }) =>
            cx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              isActive
                ? 'bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.35)]'
                : 'text-muted hover:bg-panel/60 hover:text-ink',
            )
          }
```
Keep the active left-indicator bar but animate width:
```tsx
              <span
                className={cx(
                  'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-glow transition-all',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
```
Update the footer build card to the current version string:
```tsx
      <div className="mt-auto p-3">
        <div className="panel-inset p-3">
          <p className="label-mono mb-1">Сборка</p>
          <p className="font-mono text-xs text-muted">ShadowLab v0.2.0 · local</p>
        </div>
      </div>
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck && npm run build`. Tab through nav; confirm focus rings + active glow indicator.
```bash
git add src/ui/layout/Sidebar.tsx
git commit -m "feat(ui): refine sidebar active state, focus rings, build footer"
```

---

## Task 7: Shell — AppLayout ambient layer + transition timing

**Files:** Modify: `src/ui/layout/AppLayout.tsx`

- [ ] **Step 1: Shorten page transition + add a subtle drifting glow layer.** Update the page-transition `motion.div` timing to `duration: 0.22` and wrap `main` with a non-interactive drift layer. Inside the existing `<main>` return, add as the first child:

```tsx
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 animate-drift opacity-60
            [background:radial-gradient(40%_30%_at_80%_0%,rgb(var(--accent-2)/0.06),transparent_70%)]" />
```
Make `<main>` `relative` so the layer positions correctly: change `className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-10"` to include `relative`. Update the inner transition:
```tsx
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck && npm run build`. Navigate between pages; transitions feel quick; drift halts under reduced-motion (Task 2 gate).
```bash
git add src/ui/layout/AppLayout.tsx
git commit -m "feat(ui): faster page transitions + ambient drift layer"
```

---

## Task 8: GameCard view-model (pure, TDD)

**Files:**
- Create: `src/ui/game/gameCardModel.ts`
- Create: `tests/ui/gameCardModel.test.ts`

**Interfaces:**
- Produces:
```ts
export type CardState = 'in-progress' | 'fresh' | 'soon';
export interface CardStat { icon: string; label: string; tone: 'accent' | 'accent2' | 'good' | 'warn' | 'muted'; }
export interface GameCardInput {
  def: GameDefinition;                              // id, title, tagline, theme, status, tags
  lastSave: GameSave | null;                        // most-recent save for this game (or null)
  records: Record<string, number | string | undefined>;
}
export interface GameCardModel {
  id: string; theme: GameDefinition['theme']; title: string; tagline: string;
  genre: string; emblem: string; metaTags: string[];
  state: CardState; stats: CardStat[]; ctaLabel: string;
}
export function buildGameCardModel(input: GameCardInput): GameCardModel;
```
- Consumed by Task 9 (`GameCard`).

- [ ] **Step 1: Write the failing test** — `tests/ui/gameCardModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGameCardModel } from '@/ui/game/gameCardModel';
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

const shadowDef = {
  id: 'shadow-trace', title: 'Shadow Trace', tagline: 'Расследуй.',
  theme: 'shadow', status: 'available', tags: ['detective', 'logic'],
} as unknown as GameDefinition;

const colonyDef = {
  id: 'colony', title: 'Colony Evolution', tagline: 'Построй колонию.',
  theme: 'colony', status: 'available', tags: ['strategy', 'survival'],
} as unknown as GameDefinition;

const save = (label: string) => ({ slot: 0, label, updatedAt: '2026-06-18T00:00:00Z' } as unknown as GameSave);

describe('buildGameCardModel', () => {
  it('maps genre + emblem by theme', () => {
    expect(buildGameCardModel({ def: shadowDef, lastSave: null, records: {} }).genre).toBe('детектив');
    expect(buildGameCardModel({ def: colonyDef, lastSave: null, records: {} }).genre).toBe('стратегия');
    expect(buildGameCardModel({ def: shadowDef, lastSave: null, records: {} }).emblem).toBe('◈');
  });

  it('is "fresh" with a single status chip when no save', () => {
    const m = buildGameCardModel({ def: colonyDef, lastSave: null, records: {} });
    expect(m.state).toBe('fresh');
    expect(m.ctaLabel).toBe('Открыть');
    expect(m.stats).toEqual([{ icon: '✦', label: 'ещё не играл', tone: 'muted' }]);
  });

  it('is "soon" for soon status regardless of save', () => {
    const soon = { ...colonyDef, status: 'soon' } as GameDefinition;
    const m = buildGameCardModel({ def: soon, lastSave: save('x'), records: {} });
    expect(m.state).toBe('soon');
    expect(m.stats[0].label).toBe('скоро');
  });

  it('is "in-progress" with CTA "Продолжить" and themed stats from records', () => {
    const m = buildGameCardModel({
      def: colonyDef, lastSave: save('Поселение'),
      records: { 'colony.bestDay': 14, 'colony.victories': 1 },
    });
    expect(m.state).toBe('in-progress');
    expect(m.ctaLabel).toBe('Продолжить');
    expect(m.stats).toEqual([
      { icon: '⌬', label: 'день 14', tone: 'accent' },
      { icon: '⚑', label: '1 побед', tone: 'warn' },
    ]);
  });

  it('omits absent record-based stats, falling back to the save label', () => {
    const m = buildGameCardModel({ def: shadowDef, lastSave: save('Дело 2'), records: {} });
    expect(m.state).toBe('in-progress');
    expect(m.stats).toEqual([{ icon: '◷', label: 'Дело 2', tone: 'accent' }]);
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run tests/ui/gameCardModel.test.ts`
Expected: FAIL — cannot resolve `@/ui/game/gameCardModel`.

- [ ] **Step 3: Implement** `src/ui/game/gameCardModel.ts`:

```ts
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

export type CardState = 'in-progress' | 'fresh' | 'soon';
export interface CardStat { icon: string; label: string; tone: 'accent' | 'accent2' | 'good' | 'warn' | 'muted'; }

export interface GameCardInput {
  def: GameDefinition;
  lastSave: GameSave | null;
  records: Record<string, number | string | undefined>;
}

export interface GameCardModel {
  id: string; theme: GameDefinition['theme']; title: string; tagline: string;
  genre: string; emblem: string; metaTags: string[];
  state: CardState; stats: CardStat[]; ctaLabel: string;
}

const GENRE: Record<GameDefinition['theme'], string> = { colony: 'стратегия', shadow: 'детектив' };
const EMBLEM: Record<GameDefinition['theme'], string> = { colony: '◣', shadow: '◈' };

function inProgressStats(input: GameCardInput): CardStat[] {
  const { def, lastSave, records } = input;
  const stats: CardStat[] = [];
  if (def.theme === 'colony') {
    const day = records['colony.bestDay'];
    const wins = records['colony.victories'];
    if (day != null && day !== '' && day !== 0) stats.push({ icon: '⌬', label: `день ${day}`, tone: 'accent' });
    if (typeof wins === 'number' && wins > 0) stats.push({ icon: '⚑', label: `${wins} побед`, tone: 'warn' });
  } else {
    const rank = records['shadow.bestRank'];
    if (lastSave?.label) stats.push({ icon: '◷', label: lastSave.label, tone: 'accent' });
    if (rank != null && rank !== '') stats.push({ icon: '★', label: `ранг ${rank}`, tone: 'good' });
  }
  if (stats.length === 0 && lastSave?.label) stats.push({ icon: '◷', label: lastSave.label, tone: 'accent' });
  if (stats.length === 0) stats.push({ icon: '▸', label: 'в процессе', tone: 'muted' });
  return stats;
}

export function buildGameCardModel(input: GameCardInput): GameCardModel {
  const { def, lastSave } = input;
  const soon = def.status === 'soon';
  const state: CardState = soon ? 'soon' : lastSave ? 'in-progress' : 'fresh';

  const stats: CardStat[] =
    state === 'soon' ? [{ icon: '◷', label: 'скоро', tone: 'muted' }]
    : state === 'fresh' ? [{ icon: '✦', label: 'ещё не играл', tone: 'muted' }]
    : inProgressStats(input);

  return {
    id: def.id, theme: def.theme, title: def.title, tagline: def.tagline,
    genre: GENRE[def.theme], emblem: EMBLEM[def.theme], metaTags: def.tags.slice(0, 3),
    state, stats, ctaLabel: state === 'in-progress' ? 'Продолжить' : 'Открыть',
  };
}
```

- [ ] **Step 4: Run it; verify it passes**

Run: `npx vitest run tests/ui/gameCardModel.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add src/ui/game/gameCardModel.ts tests/ui/gameCardModel.test.ts
git commit -m "feat(ui): pure GameCard view-model with state/stats/CTA"
```

---

## Task 9: GameCard component (poster + stats hybrid)

**Files:** Modify: `src/ui/game/GameCard.tsx`

**Interfaces:**
- Consumes: `buildGameCardModel`, `StatChip`, `Tag`, `SaveManager` (`lastPlayed`, `getRecord`).
- Note: keep the existing `GameCardProps` (`def`, `index?`); compute the model inside.

- [ ] **Step 1: Rebuild `GameCard`** to render the locked poster+stats hybrid. Replace the file with:

```tsx
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameDefinition } from '@/types/game-module';
import { SaveManager } from '@/services/save/SaveManager';
import { buildGameCardModel } from '@/ui/game/gameCardModel';
import { StatChip } from '@/ui/primitives/StatChip';
import { Tag } from '@/ui/primitives/Tag';

interface GameCardProps { def: GameDefinition; index?: number; }

const coverByTheme: Record<GameDefinition['theme'], string> = {
  colony:
    'radial-gradient(85% 70% at 22% 8%, rgb(var(--accent)/0.40), transparent 58%), repeating-linear-gradient(135deg, rgb(var(--accent)/0.10) 0 9px, transparent 9px 20px), linear-gradient(180deg, rgb(var(--bg)), rgb(var(--bg-2)))',
  shadow:
    'radial-gradient(90% 70% at 78% 12%, rgb(var(--accent-2)/0.42), transparent 60%), radial-gradient(80% 70% at 18% 95%, rgb(var(--accent-2)/0.30), transparent 55%), linear-gradient(180deg, rgb(var(--bg)), rgb(var(--bg-2)))',
};

export function GameCard({ def, index = 0 }: GameCardProps) {
  const lastSave = SaveManager.lastPlayed(def.id);
  const records = {
    'colony.bestDay': SaveManager.getRecord('colony.bestDay'),
    'colony.victories': SaveManager.getRecord('colony.victories'),
    'shadow.bestRank': SaveManager.getRecord('shadow.bestRank'),
  };
  const m = buildGameCardModel({ def, lastSave, records });
  const cta = m.state === 'in-progress' ? `▶ ${m.ctaLabel}` : `${m.ctaLabel} →`;
  const statTone = def.theme === 'colony' ? 'good' : 'accent2';

  return (
    <motion.div
      data-theme={def.theme}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/games/${def.id}`}
        className="group block overflow-hidden rounded-2xl border border-edge/70 bg-panel/40 shadow-e1 transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/50 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {/* Poster */}
        <div className="scanlines relative h-60 overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]" style={{ background: coverByTheme[def.theme] }} />
          <span aria-hidden className="absolute -bottom-4 right-2 font-display text-[7rem] font-bold leading-none text-ink/[0.06] transition-transform duration-500 group-hover:scale-110">{m.emblem}</span>
          <span className="absolute left-4 top-4"><Tag tone={def.theme === 'colony' ? 'good' : 'accent2'}>{m.genre}</Tag></span>
          {/* bottom scrim with title + stats */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/70 to-transparent p-4 pt-10">
            <h3 className="font-display text-2xl font-bold tracking-wide text-ink neon-text">{m.title}</h3>
            <p className="mt-0.5 text-sm text-muted">{m.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.stats.map((s) => (
                <StatChip key={s.label} icon={s.icon} label={s.label} tone={s.tone === 'accent' ? statTone : s.tone} />
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-edge/50 px-4 py-3">
          <span className="font-mono text-[0.7rem] tracking-wide text-muted">{m.metaTags.join(' · ')}</span>
          <span className="ml-auto font-display text-sm font-semibold tracking-wide text-accent transition-transform group-hover:translate-x-0.5">{cta}</span>
        </div>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Confirm `SaveManager.getRecord` + `lastPlayed` signatures.** Read `src/services/save/SaveManager.ts`; verify `getRecord(key): number | string` and `lastPlayed(id): GameSave | null` exist (used already in `HomePage`/`GameDetailPage`). If `getRecord` returns `0` for missing keys, the model already filters `0`/empty.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm run build`. View Home + catalog: posters with title-over-art, genre tag, stat chips, footer CTA; hover lifts + glow; no-progress games show the single status chip. Confirm Colony card uses green/amber tints, Shadow uses magenta.
```bash
git add src/ui/game/GameCard.tsx
git commit -m "feat(ui): poster+stats GameCard rendering the view-model"
```

---

## Task 10: Home "continue" selection (pure, TDD)

**Files:**
- Create: `src/pages/home/continueModel.ts`
- Create: `tests/ui/continueModel.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ContinueEntry { def: GameDefinition; save: GameSave; }
export function pickContinue(
  games: GameDefinition[],
  lastSaveOf: (id: string) => GameSave | null,
): ContinueEntry | null;   // most-recently-updated save across games, or null
```
- Consumed by Task 11 (`ContinueHero`/`HomePage`).

- [ ] **Step 1: Write the failing test** — `tests/ui/continueModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickContinue } from '@/pages/home/continueModel';
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

const def = (id: string) => ({ id, theme: 'colony' } as unknown as GameDefinition);
const save = (updatedAt: string) => ({ slot: 0, label: id => id, updatedAt } as unknown as GameSave);

describe('pickContinue', () => {
  it('returns null when nothing is saved', () => {
    expect(pickContinue([def('a'), def('b')], () => null)).toBeNull();
  });
  it('returns the most-recently-updated save', () => {
    const map: Record<string, GameSave> = { a: save('2026-06-10'), b: save('2026-06-17') };
    const r = pickContinue([def('a'), def('b')], (id) => map[id] ?? null);
    expect(r?.def.id).toBe('b');
  });
  it('ignores games with no save', () => {
    const map: Record<string, GameSave> = { a: save('2026-06-10') };
    const r = pickContinue([def('a'), def('b')], (id) => map[id] ?? null);
    expect(r?.def.id).toBe('a');
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run tests/ui/continueModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/pages/home/continueModel.ts`:

```ts
import type { GameDefinition } from '@/types/game-module';
import type { GameSave } from '@/types/save';

export interface ContinueEntry { def: GameDefinition; save: GameSave; }

export function pickContinue(
  games: GameDefinition[],
  lastSaveOf: (id: string) => GameSave | null,
): ContinueEntry | null {
  let best: ContinueEntry | null = null;
  for (const def of games) {
    const save = lastSaveOf(def.id);
    if (save && (!best || save.updatedAt > best.save.updatedAt)) best = { def, save };
  }
  return best;
}
```

- [ ] **Step 4: Run it; verify it passes**

Run: `npx vitest run tests/ui/continueModel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add src/pages/home/continueModel.ts tests/ui/continueModel.test.ts
git commit -m "feat(home): pure pickContinue selection"
```

---

## Task 11: ContinueHero + resume-first HomePage

**Files:**
- Create: `src/ui/home/ContinueHero.tsx`
- Modify: `src/pages/home/HomePage.tsx`

**Interfaces:**
- Consumes: `pickContinue`, `GameRegistry`, `SaveManager`, `NewsService`, `GameCard`, `Button` (`solid`), `Skeleton`, `SectionTitle`.
- `ContinueHero` props: `{ entry: ContinueEntry | null; fallbackGame: GameDefinition }`.

- [ ] **Step 1: Implement `ContinueHero`** — `src/ui/home/ContinueHero.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameDefinition } from '@/types/game-module';
import type { ContinueEntry } from '@/pages/home/continueModel';
import { Button } from '@/ui/primitives/Button';
import { Tag } from '@/ui/primitives/Tag';
import { IconPlay } from '@/ui/icons';

const emblem: Record<GameDefinition['theme'], string> = { colony: '◣', shadow: '◈' };

export function ContinueHero({ entry, fallbackGame }: { entry: ContinueEntry | null; fallbackGame: GameDefinition }) {
  const game = entry?.def ?? fallbackGame;
  const resuming = Boolean(entry);
  const to = resuming ? `/play/${game.id}?slot=${entry!.save.slot}` : `/games/${game.id}`;

  return (
    <section data-theme={game.theme} className="hero-surface scanlines p-8 md:p-12">
      <div className="absolute -right-24 -top-24 h-72 w-72 animate-float rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-accent2/10 blur-3xl" />
      <motion.div
        className="relative max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="mb-4 inline-flex"><Tag tone={game.theme === 'colony' ? 'good' : 'accent2'}>{resuming ? 'продолжить' : 'в центре внимания'}</Tag></span>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-wide text-ink neon-text md:text-6xl">{game.title}</h1>
        <p className="mt-3 font-display text-lg text-accent">{game.tagline}</p>
        {resuming && <p className="mt-1 font-mono text-xs text-muted">{entry!.save.label}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={to}><Button size="lg" variant="solid" icon={<IconPlay width={18} height={18} />}>{resuming ? 'Продолжить' : 'Играть'}</Button></Link>
          <Link to="/games"><Button size="lg" variant="ghost">Все игры</Button></Link>
        </div>
      </motion.div>
      <span aria-hidden className="pointer-events-none absolute -bottom-10 right-4 font-display text-[12rem] font-bold leading-none text-ink/[0.05]">{emblem[game.theme]}</span>
    </section>
  );
}
```

- [ ] **Step 2: Rewrite `HomePage`** to resume-first — replace the file:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GameRegistry } from '@/services/games/GameRegistry';
import { SaveManager } from '@/services/save/SaveManager';
import { NewsService, type NewsPost } from '@/services/news/NewsService';
import { pickContinue, type ContinueEntry } from '@/pages/home/continueModel';
import { GameCard } from '@/ui/game/GameCard';
import { ContinueHero } from '@/ui/home/ContinueHero';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { Skeleton } from '@/ui/feedback/Skeleton';

export function HomePage() {
  const games = GameRegistry.getAll();
  const [news, setNews] = useState<NewsPost[] | null>(null);
  const [cont, setCont] = useState<ContinueEntry | null>(null);

  useEffect(() => {
    void NewsService.list().then((p) => setNews(p.slice(0, 3)));
    setCont(pickContinue(games, (id) => SaveManager.lastPlayed(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fallback = games.find((g) => g.status !== 'soon') ?? games[0];

  return (
    <div className="space-y-14">
      <ContinueHero entry={cont} fallbackGame={fallback} />

      <section>
        <SectionTitle
          eyebrow={cont ? 'открыть новое' : 'каталог'}
          title="Игры"
          action={<Link to="/games" className="font-display text-sm text-accent hover:underline">Все игры →</Link>}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {games.map((def, i) => <GameCard key={def.id} def={def} index={i} />)}
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="журнал" title="Новости" action={<Link to="/news" className="font-display text-sm text-accent hover:underline">Все новости →</Link>} />
        <div className="grid gap-3">
          {news === null
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)
            : news.map((post) => (
                <Link key={post.slug} to={`/news/${post.slug}`} className="panel flex items-center gap-4 p-4 transition-all hover:border-accent/40">
                  <span className="chip shrink-0">{post.tag}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm text-ink">{post.title}</p>
                    <p className="truncate text-xs text-muted">{post.excerpt}</p>
                  </div>
                  <span className="ml-auto font-mono text-[0.65rem] text-muted">{post.date.slice(0, 10)}</span>
                </Link>
              ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm run build`. With no saves: hero is a spotlight ("Играть"). Create a save (play a game), reload Home: hero becomes "Продолжить" for the most-recent game; news shows skeletons then content.
```bash
git add src/ui/home/ContinueHero.tsx src/pages/home/HomePage.tsx
git commit -m "feat(home): resume-first ContinueHero + skeleton news"
```

---

## Task 12: Games catalog + genre filter (pure TDD + page)

**Files:**
- Create: `src/pages/games/genreFilter.ts`
- Create: `tests/ui/genreFilter.test.ts`
- Modify: `src/pages/games/GamesPage.tsx`

**Interfaces:**
- Produces:
```ts
export function availableGenres(games: GameDefinition[]): string[]; // ['все', ...unique theme genres]
export function filterByGenre(games: GameDefinition[], genre: string): GameDefinition[]; // 'все' → all
```

- [ ] **Step 1: Write the failing test** — `tests/ui/genreFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { availableGenres, filterByGenre } from '@/pages/games/genreFilter';
import type { GameDefinition } from '@/types/game-module';

const g = (id: string, theme: 'colony' | 'shadow') => ({ id, theme } as unknown as GameDefinition);
const games = [g('colony', 'colony'), g('shadow-trace', 'shadow')];

describe('genreFilter', () => {
  it('lists "все" plus each genre present', () => {
    expect(availableGenres(games)).toEqual(['все', 'стратегия', 'детектив']);
  });
  it('returns all for "все"', () => {
    expect(filterByGenre(games, 'все')).toHaveLength(2);
  });
  it('filters by genre', () => {
    expect(filterByGenre(games, 'детектив').map((x) => x.id)).toEqual(['shadow-trace']);
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run tests/ui/genreFilter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/pages/games/genreFilter.ts`:

```ts
import type { GameDefinition } from '@/types/game-module';

const GENRE: Record<GameDefinition['theme'], string> = { colony: 'стратегия', shadow: 'детектив' };

export function availableGenres(games: GameDefinition[]): string[] {
  const seen: string[] = [];
  for (const g of games) {
    const genre = GENRE[g.theme];
    if (!seen.includes(genre)) seen.push(genre);
  }
  return ['все', ...seen];
}

export function filterByGenre(games: GameDefinition[], genre: string): GameDefinition[] {
  if (genre === 'все') return games;
  return games.filter((g) => GENRE[g.theme] === genre);
}
```

- [ ] **Step 4: Run it; verify it passes**

Run: `npx vitest run tests/ui/genreFilter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Rebuild `GamesPage`** with filter chips — replace the file:

```tsx
import { useState } from 'react';
import { GameRegistry } from '@/services/games/GameRegistry';
import { availableGenres, filterByGenre } from '@/pages/games/genreFilter';
import { GameCard } from '@/ui/game/GameCard';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { cx } from '@/core/utils';

export function GamesPage() {
  const games = GameRegistry.getAll();
  const genres = availableGenres(games);
  const [genre, setGenre] = useState('все');
  const visible = filterByGenre(games, genre);

  return (
    <div>
      <SectionTitle eyebrow="каталог" title="Все игры" />
      <div className="mb-6 flex flex-wrap gap-2">
        {genres.map((gname) => (
          <button
            key={gname}
            onClick={() => setGenre(gname)}
            className={cx(
              'rounded-xl border px-4 py-2 font-display text-sm tracking-wide capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              genre === gname ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge/60 text-muted hover:text-ink',
            )}
          >
            {gname}
          </button>
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((def, i) => <GameCard key={def.id} def={def} index={i} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck && npm run build && npx vitest run tests/ui/genreFilter.test.ts`. Catalog shows genre chips; clicking filters cards.
```bash
git add src/pages/games/genreFilter.ts tests/ui/genreFilter.test.ts src/pages/games/GamesPage.tsx
git commit -m "feat(games): genre-filtered catalog"
```

---

## Task 13: Game Detail restyle

**Files:** Modify: `src/pages/games/GameDetailPage.tsx`

**Constraint:** keep all data/logic and the colony-slots / shadow-cases / achievements structure. Restyle only. `CaseBrowser` stays untouched.

- [ ] **Step 1: Restyle the hero + records.** In the hero `<section>`, swap the wrapper to the shared hero surface and use the new primitives:
  - Change the section class from `scanlines relative overflow-hidden rounded-3xl border border-edge/60 bg-panel/40 p-8 md:p-10` to `hero-surface scanlines p-8 md:p-10`.
  - Replace the genre `chip` span with `<Tag tone={scope === 'colony' ? 'good' : 'accent2'}>{scope === 'colony' ? 'стратегия · sim' : 'детектив · logic'}</Tag>`.
  - For the colony "Новая игра" primary button, set `variant="solid"`.
  - Replace `RecordChip` usage with `StatChip`: render `<StatChip icon="⌬" label={`день ${SaveManager.getRecord('colony.bestDay') || '—'}`} />`, `<StatChip icon="◆" label={`насел. ${SaveManager.getRecord('colony.bestPop') || '—'}`} tone="accent2" />`, `<StatChip icon="⚑" label={`${SaveManager.getRecord('colony.victories')} побед`} tone="warn" />`. Delete the local `RecordChip` helper.
  - Add imports: `import { Tag } from '@/ui/primitives/Tag';` and `import { StatChip } from '@/ui/primitives/StatChip';`.
  - Keep the Shadow disclaimer panel exactly as-is (legal copy unchanged).

- [ ] **Step 2: Tidy section rhythm.** Ensure the outer wrapper is `space-y-12` (already) and the achievements grid keeps `md:grid-cols-2`. Remove `neon-text` from any non-title heading if present (the `h1` keeps it).

- [ ] **Step 3: Verify in both themes + commit**

Run: `npm run typecheck && npm run build`. Open `/games/colony` (slots + record StatChips + solid "Новая игра") and `/games/shadow-trace` (cases via untouched `CaseBrowser` + disclaimer intact). Confirm the in-page game theming matches baseline intent.
```bash
git add src/pages/games/GameDetailPage.tsx
git commit -m "feat(games): restyle detail hero + records as StatChips"
```

---

## Task 14: Profile + Achievements restyle

**Files:** Modify: `src/pages/profile/ProfilePage.tsx`, `src/pages/achievements/AchievementsPage.tsx`

- [ ] **Step 1: Profile.** Change the identity `<section>` to `panel-glass` (from `panel`). Convert the four `Stat` tiles to use `StatChip`-style emphasis: keep the `Stat` component but change its wrapper to `panel-inset shadow-e1` and the value to `font-display text-2xl text-ink` (already), label `label-mono`. Replace the inline cloud/status `chip` with `<Tag tone="muted">…</Tag>`. Add `import { Tag } from '@/ui/primitives/Tag';`. Keep name-edit logic untouched.

- [ ] **Step 2: Achievements.** Convert the tab buttons into a segmented control: wrap the `TABS` map in a container `inline-flex rounded-xl border border-edge/60 bg-panel/40 p-1` and change each button to `rounded-lg px-4 py-1.5 font-display text-sm transition-all` with active `bg-accent/15 text-accent shadow-e1` / inactive `text-muted hover:text-ink` and a focus ring. Wrap the summary panel in `panel-glass`. Keep `ProgressBar` + counts logic.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm run build`. Profile identity card reads as glass; stats tidy; Achievements tabs read as one segmented control; ProgressBar styled.
```bash
git add src/pages/profile/ProfilePage.tsx src/pages/achievements/AchievementsPage.tsx
git commit -m "feat(ui): restyle Profile (glass) + Achievements (segmented tabs)"
```

---

## Task 15: News + About + Settings restyle

**Files:** Modify: `src/pages/news/NewsPage.tsx`, `src/pages/about/AboutPage.tsx`, `src/pages/settings/SettingsPage.tsx`

- [ ] **Step 1: News.** Read `NewsPage.tsx`. Add a loading state: while posts are not yet loaded, render three `<Skeleton className="h-16" />` rows; once loaded, render the existing list with each item as `panel hover:border-accent/40`. Article view (if present) gets `panel-glass` body + `neon-text` only on the article title. Add `import { Skeleton } from '@/ui/feedback/Skeleton';`.

- [ ] **Step 2: About.** Read `AboutPage.tsx`. Apply the type scale + `panel`/`panel-glass` sections, accent eyebrows via `SectionTitle`, and ensure the Shadow Trace fiction/safety disclaimer is present and styled as a bordered `panel-inset` mono note (copy unchanged). Remove stray `neon-text` from sub-headings.

- [ ] **Step 3: Settings.** In `SettingsPage.tsx`: change the quality and language `Row` button groups into the same segmented-control treatment as Achievements (container `inline-flex rounded-lg border border-edge/60 bg-panel/40 p-1`, active `bg-accent/15 text-accent`); give `Toggle` an accent focus ring and `shadow-glow` on the knob when on; wrap each `<section className="panel ...">` consistently and confirm the wipe `Modal` uses the polished glass style from Task 3. No logic/handler changes.

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm run build`. News skeleton→list; About reads cleanly with disclaimer; Settings controls consistent; wipe modal styled; export/import/wipe still work.
```bash
git add src/pages/news/NewsPage.tsx src/pages/about/AboutPage.tsx src/pages/settings/SettingsPage.tsx
git commit -m "feat(ui): restyle News (skeletons), About, Settings (segmented controls)"
```

---

## Task 16: Launcher chrome + LoadingScreen

**Files:** Modify: `src/ui/feedback/LoadingScreen.tsx` (and inspect `src/ui/game/GameCanvasWrapper.tsx` for chrome only)

**Constraint:** Only the loading/return **chrome** — never the game canvas, HUD, or scene.

- [ ] **Step 1: Polish `LoadingScreen`.** Keep props (`progress`, `label`, `hint`). Restyle: center stack on `scanlines`, the spinner ring uses `border-accent/50`, add a faint `shadow-glow` halo, label keeps `neon-text`, hint mono. Ensure the indeterminate bar uses `animate-shimmer` (so it halts under reduced-motion) instead of a bespoke scan. Replace the indeterminate branch:

```tsx
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-2">
            <div className="h-full w-1/3 animate-[scan_1.2s_linear_infinite] rounded-full bg-accent shadow-glow" />
          </div>
        )}
```
(Keep `scan`; it is already neutralized by the reduced-motion gate.)

- [ ] **Step 2: Inspect `GameCanvasWrapper`** (read-only check). If it renders portal chrome (title bar / back button) around the canvas, restyle only those wrapper elements to match (glass bar, `Tag` for title, focus rings). **Do not** alter the canvas mount, `PortalBridge`, or HUD overlay. If the wrapper is purely the canvas + game HUD, leave it untouched and note that in the commit.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm run build`. Launch a game; loading screen reads polished; the game itself (canvas + HUD) is visually identical to baseline.
```bash
git add src/ui/feedback/LoadingScreen.tsx
git commit -m "feat(ui): polish launcher LoadingScreen chrome"
```

---

## Task 17: SaveSlotCard + AchievementBadge + ProfileWidget polish

**Files:** Modify: `src/ui/game/SaveSlotCard.tsx`, `src/ui/profile/AchievementBadge.tsx`, `src/ui/profile/ProfileWidget.tsx`

- [ ] **Step 1: SaveSlotCard.** Read the file. Apply `panel` + `shadow-e1`, hover `border-accent/40`, use `Tag`/`StatChip` for slot meta and timestamps, `Button` `subtle`/`danger` for load/delete (keep handlers/props). Empty slot → muted dashed state.

- [ ] **Step 2: AchievementBadge.** Read the file. Unlocked → `border-accent/40` + faint `shadow-glow` + crisp icon; locked → muted, lower contrast; progress (if shown) via `ProgressBar`. Keep `def`/`progress` props.

- [ ] **Step 3: ProfileWidget.** Tighten to the type scale; hover `border-accent/40 bg-panel`; keep `Avatar` gradient (it reads theme vars — leave as-is). Focus ring on the link.

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm run build`. Colony detail save slots, Achievements badges (locked/unlocked), header profile widget all read consistently.
```bash
git add src/ui/game/SaveSlotCard.tsx src/ui/profile/AchievementBadge.tsx src/ui/profile/ProfileWidget.tsx
git commit -m "feat(ui): polish SaveSlotCard, AchievementBadge, ProfileWidget"
```

---

## Task 18: Final verification — full green + in-game visual diff + a11y

**Files:** none (verification only).

- [ ] **Step 1: Full automated gate**

Run:
```bash
npm run typecheck && npm run test && npm run build
```
Expected: typecheck clean; **vitest: 9 original + 4 new files (motion, gameCardModel, continueModel, genreFilter) all passing**; build succeeds.

- [ ] **Step 2: Token guard — games unchanged**

Run:
```bash
git diff --stat HEAD~ -- src/styles/tokens.css
```
Confirm the diff touches only the `:root, [data-theme='portal']` block. Manually verify the `[data-theme='colony']` and `[data-theme='shadow']` blocks are byte-identical to baseline.

- [ ] **Step 3: In-game visual diff (the core boundary check)**

`npm run dev`. Launch **Colony Evolution** and **Shadow Trace**; for each, confirm the in-game UI (HUD, terminal, connection board, scenes, buttons) looks **identical to the Task 0 baseline**. Confirm `src/games/**` and `CaseBrowser.tsx` were never modified (`git log --oneline -- src/games src/pages/games/CaseBrowser.tsx` shows no redesign commits).

- [ ] **Step 4: Portal visual + a11y pass**

For each portal page (Home, Games, Game Detail ×2 themes, Profile, Achievements, News, About, Settings, Launcher loading): verify type scale/hierarchy, elevation depth, glow only on hero/titles, hover/focus states. Keyboard-only Tab pass: visible focus rings everywhere. Toggle reduced-motion (OS + Settings): ambient drift/scan/float stop. Check mobile widths (drawer nav, single-column grids, hero legibility).

- [ ] **Step 5: Final commit / tag**
```bash
git add -A && git commit -m "chore: portal redesign verification pass" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** §3 color/depth → Task 1; type scale → Tasks 1,3 + applied per page; motion/reduced-motion → Task 2; §4 primitives → Tasks 3–4; shell → Tasks 5–7; GameCard → Tasks 8–9; ContinueHero/home → Tasks 10–11; catalog/filter → Task 12; detail → Task 13; profile/achievements → Task 14; news/about/settings → Task 15; launcher → Task 16; remaining components → Task 17; §9 verification incl. in-game diff → Task 18. §2 boundary enforced by Global Constraints + Task 18 Step 2–3.
- **Placeholders:** none — all code steps carry concrete code; page-restyle tasks specify exact class strings and the precise elements to change (read-first where the file wasn't fully quoted in brainstorming).
- **Type consistency:** `Tone` union shared by `Tag`/`StatChip`; `CardStat.tone` matches it; `GameCardModel`/`GameCardInput`/`buildGameCardModel`, `ContinueEntry`/`pickContinue`, `availableGenres`/`filterByGenre`, `motionAllowed` names are consistent across defining and consuming tasks.
- **Known follow-up to confirm during execution (not blocking):** record key `shadow.bestRank` — if `SaveManager` exposes a different key, adjust the one line in `inProgressStats`; the model already degrades gracefully (falls back to the save label).
