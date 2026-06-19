# Auth + Cloud Progress + Home Upgrade — Design Spec

**Date:** 2026-06-19
**Branch / base:** `feat/auth-cloud-home` ← `portal-redesign-impl` (PR #1, `c90f4fd`). Built in the isolated worktree `C:/Projects/browser_game-auth` (the main tree is a contended shared workspace).
**Supabase project:** `denfry's Project` — ref `ofiybdapqcyxbnjbavqi`, Postgres 17, region `eu-west-1`. URL `https://ofiybdapqcyxbnjbavqi.supabase.co`. Public schema is empty at design time (only `auth.*` exists).

**Direction (locked with user):**
- Auth methods: **email + password**, **Google OAuth**, **GitHub OAuth**.
- Mode: **guest-first** — game is fully playable on `localStorage` with no network; login is **optional** and enables **cloud sync + cross-device** progress.
- Home (on top of PR #1's resume-first redesign): add **account block**, **progress summary dashboard**, **achievements showcase**.

---

## 1. Goal & Non-Goals

### Goal
Let players optionally create an account (email/password, Google, GitHub) so their portal-wide progress (the single `SaveFile`: profile, settings, achievements, game slots, records) syncs to Supabase and follows them across devices — without degrading the existing offline, guest-playable experience. Upgrade the home page so it surfaces account state, an at-a-glance progress dashboard, and recent achievements.

### Non-Goals
- **No change to in-game UI/logic** (`src/games/**`). Auth/sync/home are portal-layer only.
- **No normalized per-entity cloud schema.** The sync unit is the whole `SaveFile` JSON blob (matches the existing single-`SaveFile` model). Leaderboards / social / normalized tables are explicitly deferred.
- **No replacement of the local storage backend.** `LocalStorageAdapter` stays the on-device source of truth; cloud is an additive sync layer, not a `StorageAdapter` swap.
- **No realtime multi-device merge.** Cross-device conflicts are resolved last-write-wins at the file level, with a one-time prompt when both sides hold meaningful, differing data.
- **No framework/stack change.** React 18 + Vite + TypeScript + Tailwind + CSS variables + Zustand + framer-motion stay. One new runtime dependency: `@supabase/supabase-js` v2.
- **No mandatory login.** The app must run and play with Supabase env vars absent.

---

## 2. Architecture Overview

```
                         ┌─────────────────────────────┐
   guest play  ───────►  │ SaveManager (singleton)      │  ◄── unchanged source of truth
                         │  + LocalStorageAdapter       │
                         └─────────────┬───────────────┘
                                       │ emits appBus 'save:dirty' / 'save:written'
                                       ▼
   login/logout ─► useAuthStore ─► CloudSync service ─► supabase.from('game_saves')
        ▲              │                  │  (pull on login, debounced push on change)
        │              │                  ▼
   AuthModal ──────────┘            ConflictModal (one-time, when local ≠ cloud)

   Home page (PR #1 ContinueHero → Games → News)
      + AccountPanel  + ProgressSummary  + AchievementsShowcase   (all read local SaveFile)
```

**Offline-first invariant:** every gameplay and save path works with zero network and no Supabase config. Cloud features layer on top and fail soft.

**New code locations**
- `src/services/supabase/client.ts` — singleton Supabase client + an `isCloudConfigured()` guard.
- `src/services/cloud/CloudSync.ts` — pull/push/conflict orchestration; pure decision logic split out for testing.
- `src/services/cloud/mergeDecision.ts` — **pure** function `decideSync(local, cloud) → SyncAction` (unit-tested, no I/O).
- `src/stores/useAuthStore.ts` — Zustand auth state wrapping Supabase auth.
- `src/ui/auth/AuthModal.tsx`, `src/ui/auth/ConflictModal.tsx` — auth + conflict UI.
- `src/ui/home/AccountPanel.tsx`, `src/ui/home/ProgressSummary.tsx`, `src/ui/home/AchievementsShowcase.tsx` — home sections.
- `src/ui/home/progressModel.ts` — **pure** aggregation of the `SaveFile` into dashboard tiles (unit-tested).
- `src/app/router.tsx` — add `/login` (and OAuth-callback handling via Supabase `detectSessionInUrl`).

**Minimal edits to existing code**
- `SaveManager.persist()` — emit a single `appBus.emit('save:dirty')` after every write (additive; CloudSync listens). Existing `save:written` event is kept.
- `bootstrap.ts` — initialize the Supabase session and start `CloudSync` if configured.
- `Header.tsx` / `ProfileWidget.tsx` — reflect auth state (avatar + name when authed; "Войти" when guest; sign-out in menu).
- `types/save.ts` — `ProfileSave.cloudLinked` already exists; reuse. (No schema bump required for cloud; the blob is stored as-is with its existing `schemaVersion`.)

---

## 3. Supabase Backend

### 3.1 Client
- Dependency: `@supabase/supabase-js@^2`.
- `client.ts` reads `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If either is missing, `isCloudConfigured()` returns `false`, no client is created, and every cloud entrypoint becomes a no-op. Files: add `.env.example` (committed) with placeholder keys; real `.env` stays gitignored.
- Client options: `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`.

### 3.2 Schema (migration `auth_cloud_saves`)
```sql
create table public.game_saves (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  data           jsonb not null,
  schema_version integer not null,
  updated_device text,
  updated_at     timestamptz not null default now()
);

alter table public.game_saves enable row level security;

create policy "own row select" on public.game_saves
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.game_saves
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.game_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row delete" on public.game_saves
  for delete using (auth.uid() = user_id);

-- keep updated_at fresh on every write
create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger game_saves_touch
  before update on public.game_saves
  for each row execute function public.touch_updated_at();
```
- Applied via the Supabase MCP `apply_migration`. After applying, run `get_advisors` (security + performance) and remediate any findings (e.g. confirm RLS is on, no `security definer` view leaks).
- No `profiles` table in v1 (the profile lives inside the blob). A `profiles` table is the natural extension point for future leaderboards.

### 3.3 Auth providers
- **Email + password**: enabled by default in Supabase. Email confirmation stays **ON** (signup returns a "check your email" state). Production needs custom SMTP; dev uses Supabase's built-in limited mailer. (Documented as an operational note; not code.)
- **Google + GitHub OAuth**: require OAuth apps created by the user (Google Cloud Console / GitHub Developer Settings) with client id/secret pasted into the Supabase dashboard, plus redirect URLs (`http://localhost:5173` for dev and the production origin). **This is a user dependency** — the buttons ship working, but light up only once the provider secrets are configured. The spec ships a step-by-step `docs/superpowers/notes/oauth-setup.md` checklist.

---

## 4. Auth (frontend)

### 4.1 `useAuthStore` (Zustand)
State: `status: 'loading' | 'guest' | 'authed'`, `user: User | null`, `session: Session | null`, `error: string | null`, `pending: boolean`.
Actions: `init()` (read current session, subscribe to `onAuthStateChange`), `signUpPassword(email, pw)`, `signInPassword(email, pw)`, `signInOAuth('google' | 'github')`, `signOut()`, `clearError()`.
- If `!isCloudConfigured()`, `init()` sets `status:'guest'` immediately and all actions no-op with a friendly error.
- `onAuthStateChange` is the single place that flips `status` and triggers `CloudSync.onAuthChange(session)`.

### 4.2 `AuthModal`
- Tabs: **Вход** / **Регистрация**. Email + password fields with inline validation (email format, password length). OAuth buttons (Google, GitHub). Loading + error states. Post-signup "проверьте почту" confirmation state.
- Launched from: `ProfileWidget` (header) and `AccountPanel` (home). Built on the existing shared `Modal` primitive.
- Route `/login` renders the same flow as a full page (also the OAuth redirect landing). Supabase's `detectSessionInUrl` consumes the OAuth hash; on success we route home.

---

## 5. Cloud Sync

### 5.1 Pure decision core — `decideSync(local, cloud)`
Inputs: the local `SaveFile` and the cloud row (`{ data, schema_version, updated_at }` | `null`). Output is one of:
- `push` — write local to cloud (cloud absent, or local is the only meaningful copy).
- `pull` — overwrite local with cloud (local is empty/default, cloud has data).
- `conflict` — both hold meaningful, differing data → caller shows `ConflictModal`.
- `noop` — equal/up-to-date.

"Meaningful" = not byte-equal to a freshly-defaulted `SaveFile` (no slots, zero playtime, no achievements). This function is **pure and unit-tested** with no Supabase/DOM access.

### 5.2 `CloudSync` orchestration
- **On login** (`onAuthChange` with a session): fetch the user's `game_saves` row, run `decideSync`, then:
  - `push` → upsert local; set `profile.cloudLinked = true`.
  - `pull` → `SaveManager.importAll(cloud.data)`; refresh stores.
  - `conflict` → open `ConflictModal` ("Оставить это устройство" vs "Оставить облако"), showing both timestamps and a short summary (playtime, achievements unlocked). Back up local first (SaveManager already writes a `denfry.save.backup` key). Newest `updated_at` is pre-highlighted. The chosen side becomes both local and cloud.
  - `noop` → mark linked.
- **On change while authed**: listen to `appBus 'save:dirty'`, debounce ~4 s, upsert the whole `SaveFile` (`user_id`, `data`, `schema_version`, `updated_device`). Coalesce bursts.
- **On logout**: stop listeners; keep local data intact (guest continues on this device); set `cloudLinked = false`.
- **Failure handling**: network/permission errors → bounded retry with backoff; on persistent failure show one toast and keep local intact. Never throw into gameplay.

### 5.3 Limitations (accepted)
File-level last-write-wins between devices; no field-level merge. A device that pushes after another's change wins. Acceptable for single-player progress; realtime/CRDT merge is out of scope.

---

## 6. Home Page Upgrades (on top of PR #1)

Keep PR #1's rhythm (`ContinueHero` → Games grid → News) and insert, as additive `src/ui/home/` components:

- **AccountPanel** (near top, under/*beside* ContinueHero):
  - Guest → CTA "Войти / Создать аккаунт" (opens `AuthModal`) + one-line value prop ("храните прогресс в облаке, играйте на любом устройстве").
  - Authed → profile card: avatar, display name / email, cloud-sync status chip ("Синхронизировано · только что" / "Оффлайн" / "Синхронизация…").
- **ProgressSummary** — stat tiles aggregated from the local `SaveFile` by the pure `progressModel.ts`: total playtime, games played, achievements unlocked (X / total), highlight records (e.g. `colony.bestDay`, best Shadow Trace rank). Renders with no cloud.
- **AchievementsShowcase** — horizontal strip of recently / rarely unlocked achievements, reusing `AchievementBadge` and `AchievementManager`. Empty state nudges the player toward their first unlock.
- **Header `ProfileWidget`** — auth-aware (avatar + name when authed; "Войти" when guest; sign-out menu item).

All home additions read the **local** `SaveFile` (which, after sync, reflects cloud), so they need no direct Supabase calls.

---

## 7. Error Handling & Edge Cases
- **No env / Supabase unreachable** → `isCloudConfigured()` false; cloud silently disabled; guest fully works; a subtle non-blocking notice only where login is offered.
- **Auth errors** (wrong password, email already registered, OAuth cancelled) → surfaced inline in `AuthModal`.
- **Email confirmation pending** → explicit "проверьте почту" state; user is not treated as authed until confirmed.
- **Sync failure** → retry/backoff; single toast on persistent failure; local data preserved.
- **Logout** → local data stays; cloud writes stop.
- **Schema/version**: the blob carries its own `schemaVersion`; `importAll` runs existing migrations on pulled cloud data, so an older cloud blob is migrated on download.

---

## 8. Testing
- `mergeDecision.decideSync` — table-driven unit tests (cloud absent, local default, both default, both meaningful+equal, both meaningful+differing, newer cloud vs newer local).
- `progressModel` — aggregation correctness from representative `SaveFile`s (empty, partial, full).
- `useAuthStore` — reducer/transition logic with a **mocked** Supabase client (no network); verifies status transitions and error capture.
- Supabase client and CloudSync I/O are mocked; tests never hit the network.
- Gate: existing PR #1 suite (33 tests) stays green; `npm run typecheck` and `npm run build` clean.

---

## 9. Sequencing (for the implementation plan)
1. **Foundation** — add dep; `client.ts` + `isCloudConfigured`; `.env.example`; Supabase migration + advisors; `useAuthStore`; `AuthModal` + `/login`; header auth state. *Outcome: login/logout works; no sync yet.*
2. **Cloud sync** — `mergeDecision` (pure + tests); `CloudSync` (pull/push/debounced upsert); `SaveManager.persist()` `save:dirty` emit; `ConflictModal`; `cloudLinked` wiring. *Outcome: cross-device progress.*
3. **Home upgrades** — `progressModel` (pure + tests); `AccountPanel`, `ProgressSummary`, `AchievementsShowcase`; wire into `HomePage`. *Outcome: account-aware, dashboard home.*

Each stage ends green (typecheck + build + tests) and is independently reviewable.

---

## 10. Open user dependency
Google + GitHub OAuth need provider apps + secrets configured in the Supabase dashboard (documented checklist). Email/password works end-to-end without any user action beyond the env vars.
