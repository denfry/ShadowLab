# Portal Redesign — Design Spec

**Date:** 2026-06-18
**Topic:** UI/UX redesign of the ShadowLab / Denfry Games **portal** (the site shell + portal pages). The games themselves (Colony Evolution, Shadow Trace) are explicitly out of scope.
**Direction (locked with user via visual companion):**
- Mood: **Cinematic / Atmospheric** neon-cyberpunk (evolution of the current identity, not a rewrite).
- Signature game card: **poster cover + live stats** hybrid.
- Shell: **refined left sidebar** + slim top header (current structure kept).
- Home rhythm: **resume-first** (large "Continue" hero, degrades to a featured spotlight for new players).

---

## 1. Goal & Non-Goals

### Goal
Raise the portal's visual and interaction quality to feel intentional and "expensive" while keeping the established neon-cyberpunk identity. Improve four axes the user called out: **typography & hierarchy, color & depth, page composition, motion & detail.**

### Non-Goals
- No change to any **in-game** UI, scenes, HUD, or logic (`src/games/**`).
- No change to the **colony / shadow theme token values** (in-game palettes must render identically).
- No new product features, routes, backend, or content. This is a presentation-layer redesign.
- No framework/stack change. React 18 + Vite + Tailwind + CSS variables + Zustand + framer-motion stay.
- No restructure of navigation information architecture (same 7 nav destinations).

---

## 2. Scope Boundary (critical)

The games render with the **same CSS-variable design tokens** (via `data-theme='colony' | 'shadow'`) and the **same shared primitives** (`Button`, `Modal`, `ProgressBar`, `.chip`, `.panel`). Therefore the boundary is precise:

### In scope — may change freely
- `src/ui/layout/**` — `AppLayout`, `Header`, `Sidebar`, `navItems`.
- `src/ui/primitives/**` — `Button`, `Modal`, `ProgressBar`, `SectionTitle` (**additive** changes; see §6).
- `src/ui/game/GameCard.tsx`, `src/ui/game/SaveSlotCard.tsx` — portal-side components.
- `src/ui/profile/**`, `src/ui/feedback/**` — `ProfileWidget`, `Avatar`, `AchievementBadge`, `LoadingScreen`, `ToastHost`.
- `src/pages/**` portal pages — `home`, `games/GamesPage`, `games/GameDetailPage`, `play/GameLauncherPage` (chrome only), `profile`, `achievements`, `news`, `about`, `settings`.
- `src/styles/tokens.css` — **only** the `:root` / `[data-theme='portal']` block, plus newly added shared *structural* tokens (elevation/radius) that do not alter game palettes.
- `src/styles/global.css` — base, ambience backdrop, `@layer components` utilities.
- `tailwind.config.ts` — shadows, keyframes, animations, fonts (additive).
- New components: `ContinueHero`, `StatChip`, `Skeleton`, `Tag` (under `src/ui/...`).

### Out of scope — must NOT change
- `src/games/**` (all of it: `ColonyHud`, `ShadowTraceGame`, `FakeTerminal`, `ConnectionBoard`, `WorldScene`, definitions, domain, systems).
- The `[data-theme='colony']` and `[data-theme='shadow']` blocks in `tokens.css` (**byte-for-byte unchanged**).
- `src/pages/games/CaseBrowser.tsx` — game-adjacent content (Shadow Trace case selection). It inherits shared primitive/token polish passively but is **not** redesigned in this effort.
- Game domain/logic, services, stores, save schema, routing table.

### Boundary rules
1. **Token isolation:** richer portal look comes from the portal token block + portal components, never from editing colony/shadow values.
2. **Primitive changes are additive:** e.g. add a new `solid` Button variant for hero CTAs; do not alter the existing `primary | ghost | danger | subtle` visuals that games rely on. If an existing variant must change, it is verified in both game themes first.
3. **Card glow is component-level:** `GameCard`'s per-theme cinematic glow is implemented in the component (reading `--accent` / `--accent-2`), not by changing theme tokens.
4. **Verification gate:** after changes, launch both games and confirm in-game UI is visually unchanged (see §9).

---

## 3. Design Language

### 3.1 Color & depth (portal theme only)
Keep cyan (`--accent`) + magenta (`--accent-2`). Deepen and unify the portal neutrals; brighten edges slightly for crisper definition. Target portal block:

```
--bg:      8 11 20      --ink:     233 239 248
--bg-2:    5 7 14       --muted:   132 146 176
--panel:   16 21 38     --accent:  0 229 255     (cyan, unchanged)
--panel-2: 22 29 50     --accent-2:255 45 126    (magenta, unchanged)
--edge:    40 54 92      --good/warn/bad: unchanged
```
Add **structural** tokens (shared, palette-neutral — safe for games because they only add, never override color):
- Elevation: `--e1`, `--e2`, `--e3` documented as shadow/glow recipes (implemented as Tailwind `boxShadow` entries, not raw vars, to keep alpha modifiers working).
- Radius scale: `--r-card: 16px`, `--r-panel: 18px`, `--r-inset: 12px` (optional; Tailwind classes may be used directly instead).

**Elevation system (3 levels):**
- **e1 — flat panel:** `1px` edge border + soft black drop shadow. Default surface.
- **e2 — raised card:** e1 + a low-intensity colored glow keyed to the surface accent (cyan default, magenta/green for themed cards). Used by `GameCard`, interactive tiles.
- **e3 — hero / spotlight:** layered dual radial glows + stronger colored bloom + inner top highlight. Used by `ContinueHero`, page heroes.
- **Glass surface:** translucent panel (`bg-panel/70`) + `backdrop-blur` + `inset 0 1px 0 rgba(255,255,255,.05)` top highlight. Used by header, HUD-style tiles, modals.

**Ambient backdrop** (`global.css body::before/::after`): keep dual neon radial glows but tune for atmosphere — cyan top-left, magenta top-right, faint bottom bloom, add a subtle vignette; lower grain opacity (`0.4 → ~0.25`). Glows may slowly drift (gated by reduced-motion).

### 3.2 Typography
Fonts unchanged: **Chakra Petch** (display), **IBM Plex Mono** (mono/labels), **IBM Plex Sans** (body). Introduce an explicit, enforced scale and fix the overuse of glow.

| Role | Font | Size (desktop) | Weight | Tracking / leading |
|---|---|---|---|---|
| Hero | display | 44–60px (clamp) | 700 | tight tracking, 1.05 |
| H1 (page title) | display | 32–40px | 700 | -0.01em, 1.1 |
| H2 (section) | display | 24px | 600 | normal, 1.2 |
| H3 (card/title) | display | 18–20px | 600 | normal, 1.25 |
| Body | sans | 15–16px | 400/500 | 1.5 |
| Small | sans | 13px | 400 | 1.45 |
| Eyebrow / meta / chip | mono | 11–12px | 500 | 0.16–0.2em uppercase |

Rules:
- **Neon text-glow only on hero + game/page titles.** Remove `neon-text` from secondary headings and card bodies (current `GameCard`, `GameDetail`, `LoadingScreen` over-apply it).
- Eyebrows are mono-uppercase, accent-tinted, consistent via `SectionTitle`.
- Body copy uses `--ink` for primary, `--muted` for secondary; ensure WCAG-AA contrast on `--bg`/`--panel`.

### 3.3 Geometry & spacing
- Radius: cards/heroes `16–20px`, insets `12px`, chips/pills full. Stay rounded (cinematic), not sharp.
- Vertical rhythm: page sections separated by `48–56px`; intra-section blocks `16–24px`.
- Page padding consistent with current shell (`max-w-[1400px]`, main `px-4/8 py-6/10`).
- Grids: catalog `1 → 2 → 3` columns; home discover `1 → 2`; achievements/profile stats `2 → 4`.

### 3.4 Motion & detail
- **Page transitions:** keep `AnimatePresence`; shorten to ~`0.22s` fade + small rise; ease `[0.22,1,0.36,1]`.
- **Card hover:** lift (`-translate-y-1.5`) + glow intensify + scanline sweep + emblem scale/parallax. Tune durations to ~`300ms`.
- **Skeletons:** add `Skeleton` for async surfaces (news list, save slots, continue hero) instead of empty gaps / layout shift.
- **Focus-visible:** every interactive element gets an accent focus ring (extend the pattern already in `Button`).
- **Micro-interactions:** nav active-indicator slide, button press (`active:translate-y-px`), subtle stat-chip emphasis on hover.
- **Reduced motion:** all ambient/idle motion (drift, scan, float, ping) disabled under `prefers-reduced-motion` **and** the existing `settings.reducedMotion` toggle. The settings toggle should drive a root attribute/class that CSS honors (wire it through if not already).

---

## 4. Component System

### Shell
- **AppLayout** — owns the ambient background layer; keeps sidebar + drawer + animated outlet. Refine transition timing.
- **Header** — slim glass bar: refined logo lockup (gradient mark + wordmark), status chip, `ProfileWidget compact`. Mobile menu button preserved.
- **Sidebar** — nav items with icon + label, **glow active state** (accent inset ring + left indicator), optional light grouping (Play / Account), build-info footer. Active state restyled to e2-tinted.

### Primitives (additive changes)
- **Button** — keep `primary | ghost | danger | subtle`; **add `solid`** (filled cyan→blue gradient, e2 glow) for hero/primary CTAs. Keep focus ring, loading, sizes.
- **SectionTitle** — accent-tinted eyebrow, consistent H2.
- **Modal**, **ProgressBar** — restyle to match elevation/glass; keep API. Verify in game themes.
- **New `StatChip`** — mono label + value, themed tint, used by cards, records, profile.
- **New `Skeleton`** — shimmer block (reduced-motion → static).
- **New `Tag`** — small mono tag (genre/case tags), supersedes ad-hoc `bg-bg-2` tag spans.

### Portal components
- **GameCard** (signature) — poster cover (theme-tinted layered gradient + emblem glyph + scanline), genre `Tag` top-left, title + tagline overlaid on bottom scrim, **live stats row** (`StatChip`s) on the poster, footer strip (genre-meta + CTA: "▶ Продолжить" when progress exists, else "Открыть"). No-progress / "soon" state → single status chip, no layout jump. Per-theme palette via `data-theme`. e2 glow keyed to theme accent.
- **ContinueHero** (new, home) — when a most-recent save exists: large e3 poster of that game with progress meta (case/day, rank/%) + "▶ Продолжить" CTA. No save → featured **spotlight** of an available game with "▶ Играть". Drives the resume-first home.
- **SaveSlotCard**, **AchievementBadge**, **ProfileWidget**, **Avatar**, **LoadingScreen**, **NewsItem** — restyled to the language (elevation, type scale, reduced glow, skeletons where async).

---

## 5. Page-by-Page

- **Home** — resume-first: `ContinueHero` → "Открыть новое" discover grid of `GameCard`s → "Журнал" news strip (with skeletons). New player: hero becomes spotlight; discover shows full catalog.
- **Games (catalog)** — `SectionTitle` + genre filter `Tag`/chips (client-side over `tags`) + responsive `GameCard` grid. Empty/soon states handled.
- **Game Detail** — cinematic e3 hero (title, tagline, description, primary CTA), records as `StatChip` row (colony) / disclaimer panel (shadow), then slots (colony) or cases (shadow — `CaseBrowser` left as-is) , then game achievements grid. Restyle, keep structure & data.
- **Launcher (`GameLauncherPage`)** — only the **chrome**: refined `LoadingScreen` and the frame around `GameCanvasWrapper` (title, back affordance). The game canvas/HUD is untouched.
- **Profile** — glass identity card (avatar, name edit, id/created, cloud chip), stat grid (`StatChip`/stat cards), recent achievements (empty state).
- **Achievements** — summary panel (points + `ProgressBar`), scope filter as a **segmented control**, badge grid.
- **News** — list of `NewsItem` (skeletons while loading) + article view restyled.
- **About** — editorial layout: project intro, the two games, the Shadow Trace fiction/safety disclaimer, build/version.
- **Settings** — consistent rows, toggles, sliders, segmented controls (quality/lang); data management (export/import/wipe) with `Modal` confirm. Wire `reducedMotion` toggle to the root motion gate.

---

## 6. Technical Approach

- **Tokens:** edit only the portal block in `tokens.css`; add palette-neutral structural tokens. Leave colony/shadow blocks untouched.
- **Tailwind:** extend `boxShadow` (e1/e2/e3 glow recipes), `keyframes`/`animation` (shimmer, drift), keep font families. Additive only.
- **Primitives:** additive variants; existing variant visuals preserved for game compatibility.
- **Motion gate:** a single source of truth — CSS `prefers-reduced-motion` + a root `data-reduced-motion` attribute set from `settings.reducedMotion`. Ambient animations check it.
- **Component-level theming:** `GameCard` / `ContinueHero` read theme accents via CSS vars under `data-theme`; no token edits for game themes.
- **Incremental order (for the plan):** (1) foundation: tokens + tailwind + global ambience + motion gate; (2) primitives + new `StatChip`/`Skeleton`/`Tag`; (3) shell (Header/Sidebar/AppLayout); (4) `GameCard` + `ContinueHero`; (5) Home; (6) remaining pages; (7) full verification incl. in-game visual diff.

---

## 7. Accessibility

- WCAG-AA contrast for text on `--bg`/`--panel`; verify `--muted` passes for small text or darken background behind it.
- Visible focus rings on all interactive elements (keyboard nav).
- `prefers-reduced-motion` and the in-app toggle both fully disable non-essential motion.
- Semantic landmarks preserved (`header`, `nav`, `main`, `aside`); nav uses `NavLink` aria states; drawer trap unchanged.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Shared primitive change breaks in-game look | Additive variants only; verify Button/Modal/ProgressBar in colony + shadow themes before finishing. |
| Token edit leaks into games | Touch only the portal token block; assert colony/shadow blocks are byte-identical (diff check). |
| Scope creep into game screens (`CaseBrowser`, HUD) | Explicit no-touch list; CaseBrowser inherits passively, not redesigned. |
| Over-glow returns the "cheap" look | Glow budget: hero/titles only; elevation does the depth work, not text-shadow. |
| Motion regressions / perf | Reduced-motion gate; GPU-friendly transforms/opacity only. |

---

## 9. Verification

- `npm run typecheck` clean; `npm run build` OK; existing **9 vitest** pass.
- Manual visual pass of every portal page in the **portal** theme, plus Game Detail in **colony** and **shadow** themes.
- **In-game diff:** launch Colony and Shadow Trace; confirm HUD, terminal, board, scenes are visually unchanged vs. pre-redesign (the core boundary check).
- Keyboard-only pass (focus rings, nav, modal).
- Reduced-motion on (OS + in-app toggle): confirm ambient/idle motion stops.
- Mobile widths: drawer nav, single-column grids, hero legibility.

---

## 10. Open Questions

None blocking. Genre filtering on the catalog and any "featured/rotation" logic for the spotlight are presentation conveniences over existing data (`tags`, registry, saves) — no new data model required.
