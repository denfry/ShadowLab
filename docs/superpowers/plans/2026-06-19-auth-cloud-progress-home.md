# Auth + Cloud Progress + Home Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Supabase accounts (email/password + Google/GitHub OAuth) that sync the whole portal `SaveFile` to the cloud across devices, and upgrade the home page with an account panel, a progress dashboard, and an achievements showcase — without breaking offline guest play.

**Architecture:** `localStorage` (via `SaveManager` + `LocalStorageAdapter`) stays the on-device source of truth. A thin Supabase client + a `CloudSync` service layer on top: it pulls on login, resolves conflicts via a pure decision function, and debounce-pushes the whole `SaveFile` JSON blob to a `public.game_saves` row (one per user, RLS-protected). All cloud entrypoints fail soft when env vars are absent. Home additions read the local `SaveFile` (which reflects cloud after sync), so they need no direct Supabase calls.

**Tech Stack:** React 18, Vite, TypeScript, Zustand, TailwindCSS + CSS-var tokens, framer-motion, vitest (node env), `@supabase/supabase-js` v2, Supabase (Postgres 17, project `ofiybdapqcyxbnjbavqi`).

## Global Constraints

- **Branch / worktree:** all work in `C:/Projects/browser_game-auth` on `feat/auth-cloud-home` (base PR #1 `c90f4fd`). Never `git add -A`; stage explicit paths only.
- **Offline-first invariant:** the app must run, play, and save with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` absent. `isCloudConfigured()` gates every cloud call.
- **Do not touch `src/games/**`** and do not change `[data-theme='colony']` / `[data-theme='shadow']` token values.
- **Tests run in vitest node env** (no jsdom): test pure logic / stores only, never React components. Components are verified by `npm run typecheck` + `npm run build` + manual run, matching the existing repo pattern (logic extracted to `*Model.ts` / pure modules and unit-tested).
- **Single sync unit** = the whole `SaveFile` blob; no normalized cloud tables.
- **Language:** all user-facing copy in Russian, matching existing UI.
- **Path alias:** `@/*` → `src/*` (configured in `vite.config.ts` + `tsconfig.json`; works in tests).
- **Reuse:** `debounce` from `@/core/utils`; `Modal` / `Button` / `Tag` / `Skeleton` primitives; `AchievementBadge`; `appBus` event bus.
- **Gate per task:** the task's own test (where present) passes, plus `npm run typecheck` stays clean. Commit after each task.
- **Verify commands run from the worktree:** prefix with `cd /c/Projects/browser_game-auth &&`.

---

## File Structure

**New files**
- `src/services/supabase/client.ts` — Supabase singleton + `hasCloudConfig` (pure) + `isCloudConfigured` + `getSupabase`.
- `src/services/supabase/auth.ts` — thin auth wrapper (`signUpPassword`, `signInPassword`, `signInOAuth`, `signOut`, `getCurrentSession`, `onAuthChange`).
- `src/services/supabase/cloudSaves.ts` — `fetchCloudSave`, `upsertCloudSave`.
- `src/services/cloud/mergeDecision.ts` — pure `isMeaningfulSave`, `decideSync`.
- `src/services/cloud/saveSummary.ts` — pure `summarizeSave`, `formatPlaytime`.
- `src/services/cloud/CloudSync.ts` — orchestration (pull/push/conflict, debounced).
- `src/stores/useAuthStore.ts` — auth state + auth-modal open flag.
- `src/stores/useSyncStore.ts` — sync phase + conflict payload.
- `src/ui/auth/authForm.ts` — pure form validation.
- `src/ui/auth/AuthModal.tsx` — sign-in / sign-up modal.
- `src/ui/auth/ConflictModal.tsx` — conflict resolution modal.
- `src/pages/login/LoginPage.tsx` — `/login` route (OAuth landing).
- `src/ui/home/progressModel.ts` — pure dashboard aggregation.
- `src/ui/home/ProgressSummary.tsx`, `src/ui/home/AchievementsShowcase.tsx`, `src/ui/home/AccountPanel.tsx`.
- `.env.example` — committed placeholder env.
- `docs/superpowers/notes/oauth-setup.md` — provider setup checklist.
- Tests: `tests/cloud/hasCloudConfig.test.ts`, `tests/cloud/authStore.test.ts`, `tests/cloud/authForm.test.ts`, `tests/cloud/mergeDecision.test.ts`, `tests/cloud/saveSummary.test.ts`, `tests/ui/progressModel.test.ts`.

**Modified files**
- `src/vite-env.d.ts` — type the new env vars.
- `src/core/events/appBus.ts` — add `auth:change` + `save:dirty` events.
- `src/services/save/SaveManager.ts` — emit `save:dirty` in `persist()`.
- `src/app/bootstrap.ts` — init auth + wire CloudSync.
- `src/app/providers.tsx` — mount `AuthModal` + `ConflictModal`.
- `src/app/router.tsx` — add `/login`.
- `src/ui/profile/ProfileWidget.tsx` — auth-aware (login CTA / sign-out).
- `src/ui/layout/Header.tsx` — replace `online · local` chip wiring if needed (keep).
- `src/pages/home/HomePage.tsx` — insert `AccountPanel`, `ProgressSummary`, `AchievementsShowcase`.
- `package.json` / `package-lock.json` — add `@supabase/supabase-js`.

---

# STAGE 1 — Auth Foundation (login works, no sync yet)

## Task 1: Supabase client + env + dependency

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/services/supabase/client.ts`
- Modify: `src/vite-env.d.ts`
- Create: `.env.example`
- Test: `tests/cloud/hasCloudConfig.test.ts`

**Interfaces:**
- Produces: `hasCloudConfig(env: { url?: string; key?: string }): boolean`; `isCloudConfigured(): boolean`; `getSupabase(): SupabaseClient | null`.

- [ ] **Step 1: Install the dependency**

Run: `cd /c/Projects/browser_game-auth && npm install @supabase/supabase-js@^2`
Expected: `package.json` gains `"@supabase/supabase-js": "^2.x"` under dependencies; installs into the junctioned `node_modules`.

- [ ] **Step 2: Write the failing test**

Create `tests/cloud/hasCloudConfig.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hasCloudConfig } from '@/services/supabase/client';

describe('hasCloudConfig', () => {
  it('is false when url or key is missing', () => {
    expect(hasCloudConfig({})).toBe(false);
    expect(hasCloudConfig({ url: 'x' })).toBe(false);
    expect(hasCloudConfig({ key: 'y' })).toBe(false);
  });
  it('is true when both are present', () => {
    expect(hasCloudConfig({ url: 'https://x.supabase.co', key: 'anon' })).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/hasCloudConfig.test.ts`
Expected: FAIL — cannot resolve `@/services/supabase/client`.

- [ ] **Step 4: Write the client**

Create `src/services/supabase/client.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Pure config check — testable without env. */
export function hasCloudConfig(env: { url?: string; key?: string }): boolean {
  return Boolean(env.url && env.key);
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** True when both Supabase env vars are present. */
export function isCloudConfigured(): boolean {
  return hasCloudConfig({ url, key: anonKey });
}

/** Lazy singleton. Returns null when cloud is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isCloudConfigured()) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
```

- [ ] **Step 5: Type the env vars**

Replace `src/vite-env.d.ts` contents with:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 6: Create `.env.example`**

Create `.env.example`:
```
# Supabase — copy to .env (gitignored). Leave blank to run in guest-only mode.
VITE_SUPABASE_URL=https://ofiybdapqcyxbnjbavqi.supabase.co
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 7: Create a local `.env` for dev (NOT committed)**

Fetch the publishable/anon key via MCP `mcp__supabase__get_publishable_keys` (project `ofiybdapqcyxbnjbavqi`), then create `.env` with the real URL + key. Verify `.env` is gitignored:
Run: `cd /c/Projects/browser_game-auth && git check-ignore .env && echo IGNORED`
Expected: `IGNORED` (Vite's default `.gitignore` covers `.env`). If not ignored, add `.env` to `.gitignore` and commit that line only.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/hasCloudConfig.test.ts && npm run typecheck`
Expected: test PASS, typecheck clean.

- [ ] **Step 9: Commit**

```bash
cd /c/Projects/browser_game-auth
git add package.json package-lock.json src/services/supabase/client.ts src/vite-env.d.ts .env.example tests/cloud/hasCloudConfig.test.ts
git commit -m "feat(auth): supabase client + config guard + env typing"
```

---

## Task 2: Auth service wrapper + `useAuthStore`

**Files:**
- Create: `src/services/supabase/auth.ts`
- Create: `src/stores/useAuthStore.ts`
- Modify: `src/core/events/appBus.ts`
- Test: `tests/cloud/authStore.test.ts`

**Interfaces:**
- Consumes: `getSupabase`, `isCloudConfigured` (Task 1).
- Produces:
  - `auth.ts`: `AuthResult { ok: boolean; error?: string; needsConfirmation?: boolean }`; `signUpPassword(email,password): Promise<AuthResult>`; `signInPassword(email,password): Promise<AuthResult>`; `signInOAuth('google'|'github'): Promise<AuthResult>`; `signOut(): Promise<void>`; `getCurrentSession(): Promise<Session|null>`; `onAuthChange(cb:(s:Session|null)=>void): ()=>void`.
  - `useAuthStore`: state `{ status:'loading'|'guest'|'authed'; user:User|null; session:Session|null; error:string|null; notice:string|null; pending:boolean; authModalOpen:boolean }`; actions `init()`, `signInPassword`, `signUpPassword`, `signInOAuth`, `signOut`, `clearFeedback()`, `openAuthModal()`, `closeAuthModal()`.
  - `appBus` event `'auth:change': { userId: string | null }`.

- [ ] **Step 1: Add the appBus event**

In `src/core/events/appBus.ts`, add to the `AppEvents` interface (after `'save:written'`):
```ts
  'auth:change': { userId: string | null };
```

- [ ] **Step 2: Write the auth service wrapper**

Create `src/services/supabase/auth.ts`:
```ts
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './client';

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

const NO_CLIENT: AuthResult = { ok: false, error: 'Облако не настроено' };

export async function signUpPassword(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return NO_CLIENT;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirmation: !data.session };
}

export async function signInPassword(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return NO_CLIENT;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signInOAuth(provider: 'google' | 'github'): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return NO_CLIENT;
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/login` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
```

- [ ] **Step 3: Write the failing store test**

Create `tests/cloud/authStore.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/supabase/client', () => ({ isCloudConfigured: () => true }));
vi.mock('@/services/supabase/auth', () => ({
  signInPassword: vi.fn(),
  signUpPassword: vi.fn(),
  signInOAuth: vi.fn(),
  signOut: vi.fn(),
  getCurrentSession: vi.fn(),
  onAuthChange: vi.fn(() => () => {}),
}));

import * as auth from '@/services/supabase/auth';
import { useAuthStore } from '@/stores/useAuthStore';

beforeEach(() => {
  useAuthStore.setState({
    status: 'loading', user: null, session: null,
    error: null, notice: null, pending: false, authModalOpen: false,
  });
  vi.clearAllMocks();
});

describe('useAuthStore', () => {
  it('sets error on failed sign-in and clears pending', async () => {
    (auth.signInPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'bad creds' });
    await useAuthStore.getState().signInPassword('a@b.co', 'pw1234');
    expect(useAuthStore.getState().error).toBe('bad creds');
    expect(useAuthStore.getState().pending).toBe(false);
  });

  it('shows a confirmation notice on sign-up needing confirmation', async () => {
    (auth.signUpPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, needsConfirmation: true });
    await useAuthStore.getState().signUpPassword('a@b.co', 'pw1234');
    expect(useAuthStore.getState().notice).toMatch(/почту/i);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('drops to guest on sign-out', async () => {
    (auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useAuthStore.setState({ status: 'authed' });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('guest');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/authStore.test.ts`
Expected: FAIL — cannot resolve `@/stores/useAuthStore`.

- [ ] **Step 5: Write the store**

Create `src/stores/useAuthStore.ts`:
```ts
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import * as auth from '@/services/supabase/auth';
import { isCloudConfigured } from '@/services/supabase/client';
import { appBus } from '@/core/events/appBus';

export type AuthStatus = 'loading' | 'guest' | 'authed';

interface AuthStore {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  error: string | null;
  notice: string | null;
  pending: boolean;
  authModalOpen: boolean;
  init(): void;
  signInPassword(email: string, password: string): Promise<void>;
  signUpPassword(email: string, password: string): Promise<void>;
  signInOAuth(provider: 'google' | 'github'): Promise<void>;
  signOut(): Promise<void>;
  clearFeedback(): void;
  openAuthModal(): void;
  closeAuthModal(): void;
}

function applySession(set: (p: Partial<AuthStore>) => void, session: Session | null): void {
  set({ session, user: session?.user ?? null, status: session ? 'authed' : 'guest' });
  appBus.emit('auth:change', { userId: session?.user?.id ?? null });
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'loading',
  user: null,
  session: null,
  error: null,
  notice: null,
  pending: false,
  authModalOpen: false,

  init: () => {
    if (!isCloudConfigured()) {
      set({ status: 'guest' });
      return;
    }
    auth.onAuthChange((session) => applySession(set, session));
    void auth.getCurrentSession().then((session) => applySession(set, session));
  },

  signInPassword: async (email, password) => {
    set({ pending: true, error: null, notice: null });
    const r = await auth.signInPassword(email, password);
    set({ pending: false, error: r.ok ? null : r.error ?? 'Ошибка входа' });
    if (r.ok) set({ authModalOpen: false });
  },

  signUpPassword: async (email, password) => {
    set({ pending: true, error: null, notice: null });
    const r = await auth.signUpPassword(email, password);
    if (!r.ok) {
      set({ pending: false, error: r.error ?? 'Ошибка регистрации' });
      return;
    }
    set({
      pending: false,
      notice: r.needsConfirmation
        ? 'Проверьте почту для подтверждения регистрации.'
        : null,
      authModalOpen: r.needsConfirmation ? true : false,
    });
  },

  signInOAuth: async (provider) => {
    set({ pending: true, error: null, notice: null });
    const r = await auth.signInOAuth(provider);
    if (!r.ok) set({ pending: false, error: r.error ?? 'Ошибка входа через провайдера' });
    // On success the browser redirects to the provider; no further state change here.
  },

  signOut: async () => {
    await auth.signOut();
    set({ status: 'guest', user: null, session: null });
    appBus.emit('auth:change', { userId: null });
  },

  clearFeedback: () => set({ error: null, notice: null }),
  openAuthModal: () => set({ authModalOpen: true, error: null, notice: null }),
  closeAuthModal: () => set({ authModalOpen: false }),
}));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/authStore.test.ts && npm run typecheck`
Expected: 3 tests PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/services/supabase/auth.ts src/stores/useAuthStore.ts src/core/events/appBus.ts tests/cloud/authStore.test.ts
git commit -m "feat(auth): auth service wrapper + useAuthStore (+ auth:change event)"
```

---

## Task 3: Auth form validation model

**Files:**
- Create: `src/ui/auth/authForm.ts`
- Test: `tests/cloud/authForm.test.ts`

**Interfaces:**
- Produces: `validateEmail(email): string|null`; `validatePassword(pw): string|null`; `validateAuthForm(email,pw): { email:string|null; password:string|null; ok:boolean }`.

- [ ] **Step 1: Write the failing test**

Create `tests/cloud/authForm.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateAuthForm } from '@/ui/auth/authForm';

describe('authForm', () => {
  it('rejects empty and malformed emails', () => {
    expect(validateEmail('')).toMatch(/email/i);
    expect(validateEmail('nope')).toMatch(/email/i);
    expect(validateEmail('a@b.co')).toBeNull();
  });
  it('requires a 6+ char password', () => {
    expect(validatePassword('')).toMatch(/пароль/i);
    expect(validatePassword('12345')).toMatch(/6/);
    expect(validatePassword('123456')).toBeNull();
  });
  it('aggregates form validity', () => {
    expect(validateAuthForm('a@b.co', '123456').ok).toBe(true);
    expect(validateAuthForm('bad', '123456').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/authForm.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validator**

Create `src/ui/auth/authForm.ts`:
```ts
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Введите email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Некорректный email';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (!pw) return 'Введите пароль';
  if (pw.length < 6) return 'Минимум 6 символов';
  return null;
}

export interface AuthFormErrors {
  email: string | null;
  password: string | null;
  ok: boolean;
}

export function validateAuthForm(email: string, password: string): AuthFormErrors {
  const e = validateEmail(email);
  const p = validatePassword(password);
  return { email: e, password: p, ok: !e && !p };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/authForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/ui/auth/authForm.ts tests/cloud/authForm.test.ts
git commit -m "feat(auth): pure auth form validation model"
```

---

## Task 4: AuthModal + /login + header wiring + bootstrap auth init + OAuth doc

**Files:**
- Create: `src/ui/auth/AuthModal.tsx`
- Create: `src/pages/login/LoginPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/ui/profile/ProfileWidget.tsx`
- Modify: `src/app/bootstrap.ts`
- Create: `docs/superpowers/notes/oauth-setup.md`

**Interfaces:**
- Consumes: `useAuthStore` (Task 2), `validateAuthForm` (Task 3), `Modal`/`Button` primitives, `IconLogout`/`IconUser`/`IconClose` from `@/ui/icons`.

- [ ] **Step 1: Write the AuthModal**

Create `src/ui/auth/AuthModal.tsx`:
```tsx
import { useState } from 'react';
import { Modal } from '@/ui/primitives/Modal';
import { Button } from '@/ui/primitives/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { validateAuthForm } from './authForm';
import { isCloudConfigured } from '@/services/supabase/client';

type Tab = 'in' | 'up';

export function AuthModal() {
  const open = useAuthStore((s) => s.authModalOpen);
  const close = useAuthStore((s) => s.closeAuthModal);
  const pending = useAuthStore((s) => s.pending);
  const error = useAuthStore((s) => s.error);
  const notice = useAuthStore((s) => s.notice);
  const signIn = useAuthStore((s) => s.signInPassword);
  const signUp = useAuthStore((s) => s.signUpPassword);
  const oauth = useAuthStore((s) => s.signInOAuth);

  const [tab, setTab] = useState<Tab>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = () => {
    const v = validateAuthForm(email, password);
    if (!v.ok) {
      setLocalErr(v.email ?? v.password);
      return;
    }
    setLocalErr(null);
    if (tab === 'in') void signIn(email, password);
    else void signUp(email, password);
  };

  const cloud = isCloudConfigured();

  return (
    <Modal open={open} onClose={close} title={tab === 'in' ? 'Вход в аккаунт' : 'Создать аккаунт'}>
      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'in' ? 'primary' : 'subtle'} size="sm" onClick={() => setTab('in')}>
          Вход
        </Button>
        <Button variant={tab === 'up' ? 'primary' : 'subtle'} size="sm" onClick={() => setTab('up')}>
          Регистрация
        </Button>
      </div>

      {!cloud && (
        <p className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
          Облако не настроено. Игра работает локально; вход появится после настройки Supabase.
        </p>
      )}

      <div className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-edge/60 bg-panel/50 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
        />
        <input
          type="password"
          autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
          placeholder="пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full rounded-xl border border-edge/60 bg-panel/50 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
        />

        {(localErr || error) && <p className="text-xs text-bad">{localErr ?? error}</p>}
        {notice && <p className="text-xs text-good">{notice}</p>}

        <Button variant="solid" className="w-full" loading={pending} disabled={!cloud} onClick={submit}>
          {tab === 'in' ? 'Войти' : 'Зарегистрироваться'}
        </Button>

        <div className="flex items-center gap-3 py-1 text-[0.65rem] uppercase tracking-widest text-muted">
          <span className="h-px flex-1 bg-edge/60" /> или <span className="h-px flex-1 bg-edge/60" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={!cloud || pending} onClick={() => void oauth('google')}>
            Google
          </Button>
          <Button variant="ghost" disabled={!cloud || pending} onClick={() => void oauth('github')}>
            GitHub
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Write the LoginPage (OAuth landing / full-page entry)**

Create `src/pages/login/LoginPage.tsx`:
```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

/** Full-page entry + OAuth redirect landing. Supabase consumes the URL hash via
 *  detectSessionInUrl; once a session exists we route home. */
export function LoginPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const open = useAuthStore((s) => s.openAuthModal);

  useEffect(() => {
    if (status === 'authed') navigate('/', { replace: true });
    else if (status === 'guest') open();
  }, [status, navigate, open]);

  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <p className="font-mono text-sm text-muted">Подключение…</p>
    </div>
  );
}
```

- [ ] **Step 3: Add the `/login` route**

In `src/app/router.tsx`, add the import and a route OUTSIDE the `AppLayout` children (next to the launcher route):
```tsx
import { LoginPage } from '@/pages/login/LoginPage';
```
Add after the `/play/:id` route entry:
```tsx
  { path: '/login', element: <LoginPage /> },
```

- [ ] **Step 4: Mount AuthModal globally**

Replace `src/app/providers.tsx` with:
```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastHost } from '@/ui/feedback/ToastHost';
import { AuthModal } from '@/ui/auth/AuthModal';

export function AppProviders() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
      <AuthModal />
    </>
  );
}
```

- [ ] **Step 5: Make ProfileWidget auth-aware**

Replace `src/ui/profile/ProfileWidget.tsx` with:
```tsx
import { Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/useProfileStore';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/ui/primitives/Button';
import { IconLogout } from '@/ui/icons';
import { cx } from '@/core/utils';

interface ProfileWidgetProps {
  compact?: boolean;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="grid place-items-center rounded-xl font-display font-semibold text-bg"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))',
        boxShadow: '0 0 18px -4px rgb(var(--accent) / 0.6)',
      }}
    >
      {initial}
    </span>
  );
}

export function ProfileWidget({ compact }: ProfileWidgetProps) {
  const profile = useProfileStore((s) => s.profile);
  const points = useAchievementStore((s) => s.points);
  const status = useAuthStore((s) => s.status);
  const openAuth = useAuthStore((s) => s.openAuthModal);
  const signOut = useAuthStore((s) => s.signOut);

  if (status === 'guest') {
    return (
      <Button size="sm" variant="primary" onClick={openAuth}>
        Войти
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/profile"
        className={cx(
          'group flex items-center gap-3 rounded-xl border border-edge/60 bg-panel/50 px-2.5 py-2 transition-all hover:border-accent/40 hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          compact ? '' : 'w-full',
        )}
      >
        <Avatar name={profile.displayName} size={compact ? 34 : 40} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-medium text-ink">{profile.displayName}</p>
          <p className="font-mono text-[0.68rem] text-muted">
            {points.earned}/{points.total} очков
          </p>
        </div>
      </Link>
      {status === 'authed' && (
        <button
          onClick={() => void signOut()}
          aria-label="Выйти"
          className="grid h-9 w-9 place-items-center rounded-xl border border-edge/60 text-muted transition-colors hover:border-bad/50 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <IconLogout width={16} height={16} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Init auth in bootstrap**

In `src/app/bootstrap.ts`, add the import:
```ts
import { useAuthStore } from '@/stores/useAuthStore';
```
Add at the end of `bootstrapApp()` (after the reduced-motion block):
```ts
  // Initialize auth last; sets 'guest' when cloud is unconfigured.
  useAuthStore.getState().init();
```

- [ ] **Step 7: Write the OAuth setup doc**

Create `docs/superpowers/notes/oauth-setup.md`:
```markdown
# OAuth provider setup (Google + GitHub)

Email/password works out of the box once `.env` has the Supabase URL + anon key.
Google and GitHub require provider apps you create, then paste secrets into Supabase.

## Redirect URL (both providers + Supabase)
- Supabase callback: `https://ofiybdapqcyxbnjbavqi.supabase.co/auth/v1/callback`
- App redirect (set in Supabase → Authentication → URL Configuration → Redirect URLs):
  `http://localhost:5173/login` (dev) and your production origin `/login`.

## Google
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web).
2. Authorized redirect URI = the Supabase callback URL above.
3. Copy Client ID + Client Secret.
4. Supabase → Authentication → Providers → Google → enable, paste ID + secret.

## GitHub
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Authorization callback URL = the Supabase callback URL above.
3. Copy Client ID, generate a Client Secret.
4. Supabase → Authentication → Providers → GitHub → enable, paste ID + secret.

Until configured, the Google/GitHub buttons return a provider error; email/password is unaffected.
```

- [ ] **Step 8: Verify (typecheck + build + manual run)**

Run: `cd /c/Projects/browser_game-auth && npm run typecheck && npm run build`
Expected: both clean.
Manual: `npm run dev`, open the app. With `.env` present: header shows "Войти" → opens modal → email/password sign-up returns the "проверьте почту" notice (or signs in if confirmation disabled). Without `.env`: modal shows the "Облако не настроено" warning and buttons are disabled. Confirm guest gameplay/saving still works.

- [ ] **Step 9: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/ui/auth/AuthModal.tsx src/pages/login/LoginPage.tsx src/app/router.tsx src/app/providers.tsx src/ui/profile/ProfileWidget.tsx src/app/bootstrap.ts docs/superpowers/notes/oauth-setup.md
git commit -m "feat(auth): AuthModal + /login + auth-aware header + bootstrap init"
```

---

# STAGE 2 — Cloud Sync

## Task 5: Supabase migration (game_saves + RLS + trigger)

**Files:** none in-repo (applied to the Supabase project via MCP).

- [ ] **Step 1: Apply the migration**

Use MCP `mcp__supabase__apply_migration` on project `ofiybdapqcyxbnjbavqi`, name `auth_cloud_saves`, with:
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

create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger game_saves_touch
  before update on public.game_saves
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 2: Verify the table + RLS**

Use MCP `mcp__supabase__list_tables` (schemas `["public"]`).
Expected: `public.game_saves` present with `rls_enabled: true`.

- [ ] **Step 3: Run advisors and remediate**

Use MCP `mcp__supabase__get_advisors` (type `security`), then (type `performance`).
Expected: no critical findings for `game_saves`. The `touch_updated_at` function should set a fixed `search_path`; if the advisor flags "function search_path mutable", apply a follow-up migration `harden_touch_fn`:
```sql
create or replace function public.touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin new.updated_at = now(); return new; end $$;
```
Re-run the security advisor; confirm the finding clears.

- [ ] **Step 4: Record completion**

No commit (no repo change). Note the migration name(s) applied in the task log / PR description.

---

## Task 6: Merge decision (pure)

**Files:**
- Create: `src/services/cloud/mergeDecision.ts`
- Test: `tests/cloud/mergeDecision.test.ts`

**Interfaces:**
- Consumes: `SaveFile`, `defaultSaveFile` (for tests).
- Produces: `SyncAction = 'push'|'pull'|'conflict'|'noop'`; `isMeaningfulSave(file): boolean`; `decideSync(local: SaveFile, cloud: { data: SaveFile } | null): SyncAction`.

- [ ] **Step 1: Write the failing test**

Create `tests/cloud/mergeDecision.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { decideSync, isMeaningfulSave } from '@/services/cloud/mergeDecision';
import { defaultSaveFile } from '@/services/save/defaults';
import type { SaveFile } from '@/types/save';

function meaningful(): SaveFile {
  const f = defaultSaveFile();
  f.records['colony.bestDay'] = 5;
  return f;
}

describe('isMeaningfulSave', () => {
  it('is false for a default save', () => {
    expect(isMeaningfulSave(defaultSaveFile())).toBe(false);
  });
  it('is true once there is progress', () => {
    expect(isMeaningfulSave(meaningful())).toBe(true);
  });
});

describe('decideSync', () => {
  it('pushes a meaningful local with no cloud', () => {
    expect(decideSync(meaningful(), null)).toBe('push');
  });
  it('noops a default local with no cloud', () => {
    expect(decideSync(defaultSaveFile(), null)).toBe('noop');
  });
  it('pulls when local is default and cloud has data', () => {
    expect(decideSync(defaultSaveFile(), { data: meaningful() })).toBe('pull');
  });
  it('pushes when local has data and cloud is default', () => {
    expect(decideSync(meaningful(), { data: defaultSaveFile() })).toBe('push');
  });
  it('noops when both equal and meaningful', () => {
    const f = meaningful();
    expect(decideSync(f, { data: JSON.parse(JSON.stringify(f)) })).toBe('noop');
  });
  it('conflicts when both meaningful and different', () => {
    const a = meaningful();
    const b = meaningful();
    b.records['colony.bestDay'] = 99;
    expect(decideSync(a, { data: b })).toBe('conflict');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/mergeDecision.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `src/services/cloud/mergeDecision.ts`:
```ts
import type { SaveFile } from '@/types/save';

export type SyncAction = 'push' | 'pull' | 'conflict' | 'noop';

/** A save is "meaningful" once the player has actually made progress. */
export function isMeaningfulSave(file: SaveFile): boolean {
  const hasSlots = Object.values(file.games).some((slots) => slots.length > 0);
  const hasPlaytime = file.profile.stats.totalPlaytimeSec > 0;
  const hasAchievements = Object.keys(file.achievements.unlocked).length > 0;
  const hasRecords = Object.keys(file.records).length > 0;
  return hasSlots || hasPlaytime || hasAchievements || hasRecords;
}

function sameSave(a: SaveFile, b: SaveFile): boolean {
  const norm = (f: SaveFile) => JSON.stringify({ ...f, exportedAt: undefined });
  return norm(a) === norm(b);
}

export function decideSync(local: SaveFile, cloud: { data: SaveFile } | null): SyncAction {
  const localMeaningful = isMeaningfulSave(local);
  if (!cloud) return localMeaningful ? 'push' : 'noop';

  const cloudMeaningful = isMeaningfulSave(cloud.data);
  if (localMeaningful && !cloudMeaningful) return 'push';
  if (!localMeaningful && cloudMeaningful) return 'pull';
  if (!localMeaningful && !cloudMeaningful) return 'noop';
  return sameSave(local, cloud.data) ? 'noop' : 'conflict';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/mergeDecision.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/services/cloud/mergeDecision.ts tests/cloud/mergeDecision.test.ts
git commit -m "feat(cloud): pure decideSync + isMeaningfulSave"
```

---

## Task 7: Save summary (pure)

**Files:**
- Create: `src/services/cloud/saveSummary.ts`
- Test: `tests/cloud/saveSummary.test.ts`

**Interfaces:**
- Produces: `SaveSummary { playtimeSec:number; achievementsUnlocked:number; totalSlots:number }`; `summarizeSave(file): SaveSummary`; `formatPlaytime(sec): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/cloud/saveSummary.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { summarizeSave, formatPlaytime } from '@/services/cloud/saveSummary';
import { defaultSaveFile } from '@/services/save/defaults';

describe('formatPlaytime', () => {
  it('formats sub-minute, minutes and hours', () => {
    expect(formatPlaytime(0)).toBe('меньше минуты');
    expect(formatPlaytime(90)).toBe('1 мин');
    expect(formatPlaytime(3700)).toBe('1 ч 1 мин');
  });
});

describe('summarizeSave', () => {
  it('summarizes a default save as empty', () => {
    const s = summarizeSave(defaultSaveFile());
    expect(s).toEqual({ playtimeSec: 0, achievementsUnlocked: 0, totalSlots: 0 });
  });
  it('counts unlocked achievements and slots', () => {
    const f = defaultSaveFile();
    f.achievements.unlocked['global.first_launch'] = '2026-06-19T00:00:00.000Z';
    f.games['colony'] = [{ gameId: 'colony', slot: 0, version: 1, createdAt: 'x', updatedAt: 'x', label: 'l', payload: {} }];
    const s = summarizeSave(f);
    expect(s.achievementsUnlocked).toBe(1);
    expect(s.totalSlots).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/saveSummary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `src/services/cloud/saveSummary.ts`:
```ts
import type { SaveFile } from '@/types/save';

export interface SaveSummary {
  playtimeSec: number;
  achievementsUnlocked: number;
  totalSlots: number;
}

export function summarizeSave(file: SaveFile): SaveSummary {
  return {
    playtimeSec: file.profile.stats.totalPlaytimeSec,
    achievementsUnlocked: Object.keys(file.achievements.unlocked).length,
    totalSlots: Object.values(file.games).reduce((n, slots) => n + slots.length, 0),
  };
}

export function formatPlaytime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин`;
  return 'меньше минуты';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/cloud/saveSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/services/cloud/saveSummary.ts tests/cloud/saveSummary.test.ts
git commit -m "feat(cloud): pure save summary + playtime formatter"
```

---

## Task 8: cloudSaves data access + useSyncStore + CloudSync + wiring

**Files:**
- Create: `src/services/supabase/cloudSaves.ts`
- Create: `src/stores/useSyncStore.ts`
- Create: `src/services/cloud/CloudSync.ts`
- Modify: `src/services/save/SaveManager.ts`
- Modify: `src/core/events/appBus.ts`
- Modify: `src/app/bootstrap.ts`

**Interfaces:**
- Consumes: `getSupabase` (T1), `decideSync` (T6), `summarizeSave` (T7), `SaveManager`, `debounce`, `appBus`, profile/settings/achievement stores.
- Produces:
  - `cloudSaves`: `CloudSaveRow { data:SaveFile; schema_version:number; updated_at:string; updated_device:string|null }`; `fetchCloudSave(userId): Promise<CloudSaveRow|null>`; `upsertCloudSave(userId, file, device): Promise<void>`.
  - `useSyncStore`: `{ phase:'idle'|'syncing'|'synced'|'offline'|'error'; lastSyncedAt:string|null; conflict:SyncConflict|null; setPhase; markSynced; setConflict }`; `SyncConflict { local:SaveFile; cloud:SaveFile; localSummary:SaveSummary; cloudSummary:SaveSummary; cloudUpdatedAt:string }`.
  - `CloudSync`: `{ onAuthChange(userId:string|null):Promise<void>; resolveConflict('local'|'cloud'):Promise<void>; stop():void }`.
  - `appBus` event `'save:dirty': void`.

- [ ] **Step 1: Add the `save:dirty` event**

In `src/core/events/appBus.ts`, add to `AppEvents` (after `'auth:change'`):
```ts
  'save:dirty': void;
```

- [ ] **Step 2: Emit `save:dirty` from SaveManager**

In `src/services/save/SaveManager.ts`, change `persist()` to:
```ts
  private async persist(): Promise<void> {
    await this.adapter.set(ROOT_KEY, this.file);
    appBus.emit('save:dirty', undefined);
  }
```
(`appBus` is already imported in this file.)

- [ ] **Step 3: Write the cloud data access**

Create `src/services/supabase/cloudSaves.ts`:
```ts
import type { SaveFile } from '@/types/save';
import { getSupabase } from './client';

export interface CloudSaveRow {
  data: SaveFile;
  schema_version: number;
  updated_at: string;
  updated_device: string | null;
}

export async function fetchCloudSave(userId: string): Promise<CloudSaveRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('game_saves')
    .select('data, schema_version, updated_at, updated_device')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as CloudSaveRow | null) ?? null;
}

export async function upsertCloudSave(userId: string, file: SaveFile, device: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('game_saves').upsert({
    user_id: userId,
    data: file,
    schema_version: file.schemaVersion,
    updated_device: device,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Write the sync store**

Create `src/stores/useSyncStore.ts`:
```ts
import { create } from 'zustand';
import type { SaveFile } from '@/types/save';
import type { SaveSummary } from '@/services/cloud/saveSummary';

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncConflict {
  local: SaveFile;
  cloud: SaveFile;
  localSummary: SaveSummary;
  cloudSummary: SaveSummary;
  cloudUpdatedAt: string;
}

interface SyncStore {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  conflict: SyncConflict | null;
  setPhase(phase: SyncPhase): void;
  markSynced(at: string): void;
  setConflict(conflict: SyncConflict | null): void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  phase: 'idle',
  lastSyncedAt: null,
  conflict: null,
  setPhase: (phase) => set({ phase }),
  markSynced: (at) => set({ phase: 'synced', lastSyncedAt: at }),
  setConflict: (conflict) => set({ conflict }),
}));
```

- [ ] **Step 5: Write the CloudSync service**

Create `src/services/cloud/CloudSync.ts`:
```ts
import type { SaveFile } from '@/types/save';
import { SaveManager } from '@/services/save/SaveManager';
import { appBus } from '@/core/events/appBus';
import { debounce, nowIso } from '@/core/utils';
import { fetchCloudSave, upsertCloudSave } from '@/services/supabase/cloudSaves';
import { decideSync } from './mergeDecision';
import { summarizeSave } from './saveSummary';
import { useSyncStore } from '@/stores/useSyncStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAchievementStore } from '@/stores/useAchievementStore';

const PUSH_DEBOUNCE = 4000;
const DEVICE =
  typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'unknown';

class CloudSyncImpl {
  private userId: string | null = null;
  private unsubDirty: (() => void) | null = null;
  private suppressDirty = false;
  private pushDebounced = debounce(() => void this.push(), PUSH_DEBOUNCE);

  async onAuthChange(userId: string | null): Promise<void> {
    if (userId === this.userId) return;
    this.userId = userId;
    if (!userId) {
      this.stop();
      return;
    }
    await this.initialSync();
    this.startListening();
  }

  stop(): void {
    this.unsubDirty?.();
    this.unsubDirty = null;
    this.pushDebounced.cancel();
    useSyncStore.getState().setPhase('idle');
  }

  private startListening(): void {
    this.unsubDirty?.();
    this.unsubDirty = appBus.on('save:dirty', () => {
      if (this.suppressDirty) {
        this.suppressDirty = false;
        return;
      }
      useSyncStore.getState().setPhase('syncing');
      this.pushDebounced();
    });
  }

  private async initialSync(): Promise<void> {
    if (!this.userId) return;
    useSyncStore.getState().setPhase('syncing');
    let cloud;
    try {
      cloud = await fetchCloudSave(this.userId);
    } catch {
      useSyncStore.getState().setPhase('error');
      return;
    }
    const local = SaveManager.getFile();
    const action = decideSync(local, cloud);
    if (action === 'push') {
      await this.push();
    } else if (action === 'pull' && cloud) {
      await this.applyCloud(cloud.data);
      useSyncStore.getState().markSynced(cloud.updated_at);
    } else if (action === 'conflict' && cloud) {
      useSyncStore.getState().setConflict({
        local,
        cloud: cloud.data,
        localSummary: summarizeSave(local),
        cloudSummary: summarizeSave(cloud.data),
        cloudUpdatedAt: cloud.updated_at,
      });
      useSyncStore.getState().setPhase('idle');
    } else {
      useSyncStore.getState().markSynced(nowIso());
    }
    await this.markLinked();
  }

  private async applyCloud(data: SaveFile): Promise<void> {
    this.suppressDirty = true;
    await SaveManager.importAll(data);
    useProfileStore.getState().hydrate(SaveManager.getProfile());
    useSettingsStore.getState().hydrate(SaveManager.getSettings());
    useAchievementStore.getState().refresh();
  }

  private async push(): Promise<void> {
    if (!this.userId) return;
    try {
      await upsertCloudSave(this.userId, SaveManager.getFile(), DEVICE);
      useSyncStore.getState().markSynced(nowIso());
    } catch {
      useSyncStore.getState().setPhase('error');
    }
  }

  private async markLinked(): Promise<void> {
    if (!SaveManager.getProfile().cloudLinked) {
      await SaveManager.setProfile({ cloudLinked: true });
      useProfileStore.getState().refresh();
    }
  }

  async resolveConflict(choice: 'local' | 'cloud'): Promise<void> {
    const c = useSyncStore.getState().conflict;
    if (!c) return;
    useSyncStore.getState().setConflict(null);
    if (choice === 'cloud') await this.applyCloud(c.cloud);
    await this.push();
    this.startListening();
  }
}

export const CloudSync = new CloudSyncImpl();
```

- [ ] **Step 6: Wire CloudSync into bootstrap**

In `src/app/bootstrap.ts`, add imports:
```ts
import { isCloudConfigured } from '@/services/supabase/client';
import { CloudSync } from '@/services/cloud/CloudSync';
```
Immediately BEFORE the `useAuthStore.getState().init();` line (added in Task 4), insert:
```ts
  // Drive cloud sync from auth changes (listener must exist before init() emits).
  if (isCloudConfigured()) {
    appBus.on('auth:change', ({ userId }) => void CloudSync.onAuthChange(userId));
  }
```

- [ ] **Step 7: Verify (typecheck + build)**

Run: `cd /c/Projects/browser_game-auth && npm run typecheck && npm run build && npm test`
Expected: typecheck + build clean; full suite green (existing 33 + new cloud tests).

- [ ] **Step 8: Manual two-device check**

With `.env` configured and OAuth/email working: in browser A, sign up + play (make progress) → confirm a row appears via MCP `mcp__supabase__execute_sql` (`select user_id, schema_version, updated_at from public.game_saves`). In browser B (or a private window), sign in with the same account → progress is pulled. Make differing local progress as a guest, then sign in → ConflictModal appears (built in Task 9). Note: ConflictModal UI lands in Task 9; here verify push/pull + the `game_saves` row only.

- [ ] **Step 9: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/services/supabase/cloudSaves.ts src/stores/useSyncStore.ts src/services/cloud/CloudSync.ts src/services/save/SaveManager.ts src/core/events/appBus.ts src/app/bootstrap.ts
git commit -m "feat(cloud): CloudSync (pull/push/conflict) + sync store + save:dirty"
```

---

## Task 9: ConflictModal

**Files:**
- Create: `src/ui/auth/ConflictModal.tsx`
- Modify: `src/app/providers.tsx`

**Interfaces:**
- Consumes: `useSyncStore` (T8), `CloudSync.resolveConflict` (T8), `formatPlaytime` (T7), `Modal`/`Button`.

- [ ] **Step 1: Write the ConflictModal**

Create `src/ui/auth/ConflictModal.tsx`:
```tsx
import { Modal } from '@/ui/primitives/Modal';
import { Button } from '@/ui/primitives/Button';
import { useSyncStore } from '@/stores/useSyncStore';
import { CloudSync } from '@/services/cloud/CloudSync';
import { formatPlaytime } from '@/services/cloud/saveSummary';

export function ConflictModal() {
  const conflict = useSyncStore((s) => s.conflict);
  const open = Boolean(conflict);
  const close = () => useSyncStore.getState().setConflict(null);

  return (
    <Modal open={open} onClose={close} title="Конфликт сохранений">
      {conflict && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Прогресс на этом устройстве и в облаке различается. Какую версию оставить?
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel p-4">
              <p className="mb-2 font-display text-sm text-ink">Это устройство</p>
              <p className="text-xs text-muted">Время: {formatPlaytime(conflict.localSummary.playtimeSec)}</p>
              <p className="text-xs text-muted">Достижения: {conflict.localSummary.achievementsUnlocked}</p>
              <p className="text-xs text-muted">Сохранений: {conflict.localSummary.totalSlots}</p>
              <Button variant="solid" className="mt-3 w-full" onClick={() => void CloudSync.resolveConflict('local')}>
                Оставить это
              </Button>
            </div>
            <div className="panel p-4">
              <p className="mb-2 font-display text-sm text-ink">Облако</p>
              <p className="text-xs text-muted">Время: {formatPlaytime(conflict.cloudSummary.playtimeSec)}</p>
              <p className="text-xs text-muted">Достижения: {conflict.cloudSummary.achievementsUnlocked}</p>
              <p className="text-xs text-muted">Сохранений: {conflict.cloudSummary.totalSlots}</p>
              <p className="mt-1 font-mono text-[0.6rem] text-muted">{conflict.cloudUpdatedAt.slice(0, 16).replace('T', ' ')}</p>
              <Button variant="primary" className="mt-3 w-full" onClick={() => void CloudSync.resolveConflict('cloud')}>
                Оставить облако
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Mount it globally**

In `src/app/providers.tsx`, add the import and render it next to `AuthModal`:
```tsx
import { ConflictModal } from '@/ui/auth/ConflictModal';
```
```tsx
      <AuthModal />
      <ConflictModal />
```

- [ ] **Step 3: Verify**

Run: `cd /c/Projects/browser_game-auth && npm run typecheck && npm run build`
Expected: clean. Manual: trigger a conflict (guest progress, then sign in to an account that already has differing cloud data) → modal shows both summaries; choosing a side resolves and resumes syncing.

- [ ] **Step 4: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/ui/auth/ConflictModal.tsx src/app/providers.tsx
git commit -m "feat(cloud): conflict resolution modal"
```

---

# STAGE 3 — Home Upgrades

## Task 10: Progress dashboard model (pure)

**Files:**
- Create: `src/ui/home/progressModel.ts`
- Test: `tests/ui/progressModel.test.ts`

**Interfaces:**
- Consumes: `SaveFile`, `formatPlaytime` (T7).
- Produces: `ProgressTile { label:string; value:string }`; `buildProgressTiles(file, achUnlocked:number, achTotal:number, records:Record<string,number>): ProgressTile[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/progressModel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildProgressTiles } from '@/ui/home/progressModel';
import { defaultSaveFile } from '@/services/save/defaults';

describe('buildProgressTiles', () => {
  it('always returns time / games / achievements tiles', () => {
    const tiles = buildProgressTiles(defaultSaveFile(), 0, 17, {});
    expect(tiles.map((t) => t.label)).toEqual(['Время в играх', 'Игр начато', 'Достижения']);
    expect(tiles[2].value).toBe('0/17');
  });
  it('appends a colony best-day tile when present', () => {
    const tiles = buildProgressTiles(defaultSaveFile(), 3, 17, { 'colony.bestDay': 12 });
    expect(tiles.some((t) => t.value === '12')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/ui/progressModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the model**

Create `src/ui/home/progressModel.ts`:
```ts
import type { SaveFile } from '@/types/save';
import { formatPlaytime } from '@/services/cloud/saveSummary';

export interface ProgressTile {
  label: string;
  value: string;
}

export function buildProgressTiles(
  file: SaveFile,
  achUnlocked: number,
  achTotal: number,
  records: Record<string, number>,
): ProgressTile[] {
  const tiles: ProgressTile[] = [
    { label: 'Время в играх', value: formatPlaytime(file.profile.stats.totalPlaytimeSec) },
    { label: 'Игр начато', value: String(Object.values(file.games).filter((s) => s.length > 0).length) },
    { label: 'Достижения', value: `${achUnlocked}/${achTotal}` },
  ];
  const bestDay = records['colony.bestDay'];
  if (bestDay && bestDay > 0) tiles.push({ label: 'Колония · лучший день', value: String(bestDay) });
  return tiles;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Projects/browser_game-auth && npx vitest run tests/ui/progressModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/ui/home/progressModel.ts tests/ui/progressModel.test.ts
git commit -m "feat(home): pure progress dashboard model"
```

---

## Task 11: ProgressSummary + AchievementsShowcase + HomePage wiring

**Files:**
- Create: `src/ui/home/ProgressSummary.tsx`
- Create: `src/ui/home/AchievementsShowcase.tsx`
- Modify: `src/pages/home/HomePage.tsx`

**Interfaces:**
- Consumes: `buildProgressTiles` (T10), `useAchievementStore`, `AchievementManager`, `SaveManager`, `SectionTitle`, `AchievementBadge`.

- [ ] **Step 1: Write ProgressSummary**

Create `src/ui/home/ProgressSummary.tsx`:
```tsx
import { SaveManager } from '@/services/save/SaveManager';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { buildProgressTiles } from './progressModel';

export function ProgressSummary() {
  const progress = useAchievementStore((s) => s.progress);
  const defs = useAchievementStore((s) => s.defs);
  const unlocked = Object.values(progress).filter((p) => p.unlocked).length;
  const tiles = buildProgressTiles(SaveManager.getFile(), unlocked, defs.length, SaveManager.getRecords());

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="panel p-4">
          <p className="font-display text-2xl text-ink neon-text">{t.value}</p>
          <p className="mt-1 text-xs text-muted">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write AchievementsShowcase**

Create `src/ui/home/AchievementsShowcase.tsx`:
```tsx
import { useAchievementStore } from '@/stores/useAchievementStore';
import { AchievementManager } from '@/services/achievements/AchievementManager';
import { AchievementBadge } from '@/ui/profile/AchievementBadge';

export function AchievementsShowcase() {
  const progress = useAchievementStore((s) => s.progress);
  const byId = new Map(AchievementManager.getDefinitions().map((d) => [d.id, d]));

  const recent = Object.values(progress)
    .filter((p) => p.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, 4);

  if (recent.length === 0) {
    return (
      <p className="panel p-5 text-sm text-muted">
        Пока нет достижений — сыграйте, чтобы открыть первое.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {recent.map((p) => {
        const def = byId.get(p.id);
        return def ? <AchievementBadge key={p.id} def={def} progress={p} /> : null;
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire into HomePage**

In `src/pages/home/HomePage.tsx`, add imports:
```tsx
import { ProgressSummary } from '@/ui/home/ProgressSummary';
import { AchievementsShowcase } from '@/ui/home/AchievementsShowcase';
```
Insert a progress section after the `<ContinueHero .../>` line and before the Games `<section>`:
```tsx
      <section>
        <SectionTitle eyebrow="профиль" title="Ваш прогресс" />
        <ProgressSummary />
      </section>
```
Add an achievements section just before the News `<section>`:
```tsx
      <section>
        <SectionTitle
          eyebrow="награды"
          title="Достижения"
          action={
            <Link to="/achievements" className="font-display text-sm text-accent hover:underline">
              Все достижения →
            </Link>
          }
        />
        <AchievementsShowcase />
      </section>
```
(`Link` and `SectionTitle` are already imported in HomePage.)

- [ ] **Step 4: Verify**

Run: `cd /c/Projects/browser_game-auth && npm run typecheck && npm run build`
Expected: clean. Manual: home shows the 3–4 stat tiles and the achievements strip (or the empty-state line for a fresh profile).

- [ ] **Step 5: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/ui/home/ProgressSummary.tsx src/ui/home/AchievementsShowcase.tsx src/pages/home/HomePage.tsx
git commit -m "feat(home): progress dashboard + achievements showcase"
```

---

## Task 12: AccountPanel + HomePage wiring + final verification

**Files:**
- Create: `src/ui/home/AccountPanel.tsx`
- Modify: `src/pages/home/HomePage.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (T2), `useSyncStore` (T8), `useProfileStore`, `Button`, `Tag`, `Avatar` (from ProfileWidget).

- [ ] **Step 1: Write AccountPanel**

Create `src/ui/home/AccountPanel.tsx`:
```tsx
import { useAuthStore } from '@/stores/useAuthStore';
import { useSyncStore } from '@/stores/useSyncStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { Button } from '@/ui/primitives/Button';
import { Tag } from '@/ui/primitives/Tag';
import { Avatar } from '@/ui/profile/ProfileWidget';

const PHASE_LABEL: Record<string, string> = {
  idle: 'Не синхронизировано',
  syncing: 'Синхронизация…',
  synced: 'Синхронизировано',
  offline: 'Оффлайн',
  error: 'Ошибка синхронизации',
};

export function AccountPanel() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const openAuth = useAuthStore((s) => s.openAuthModal);
  const profile = useProfileStore((s) => s.profile);
  const phase = useSyncStore((s) => s.phase);

  if (status !== 'authed') {
    return (
      <div className="panel flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-ink">Сохраняйте прогресс в облаке</p>
          <p className="text-sm text-muted">
            Войдите, чтобы синхронизировать достижения и сохранения между устройствами.
          </p>
        </div>
        <Button variant="solid" onClick={openAuth}>
          Войти / Создать аккаунт
        </Button>
      </div>
    );
  }

  return (
    <div className="panel flex flex-wrap items-center gap-4 p-5">
      <Avatar name={profile.displayName} size={48} />
      <div className="min-w-0">
        <p className="font-display text-lg text-ink">{profile.displayName}</p>
        <p className="truncate font-mono text-xs text-muted">{user?.email ?? ''}</p>
      </div>
      <span className="ml-auto">
        <Tag tone={phase === 'error' ? 'warn' : phase === 'synced' ? 'good' : 'accent'}>
          {PHASE_LABEL[phase]}
        </Tag>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Wire into HomePage (top, under the hero)**

In `src/pages/home/HomePage.tsx`, add import:
```tsx
import { AccountPanel } from '@/ui/home/AccountPanel';
```
Insert `<AccountPanel />` immediately after `<ContinueHero .../>` and before the "Ваш прогресс" section:
```tsx
      <AccountPanel />
```

- [ ] **Step 3: Full verification**

Run: `cd /c/Projects/browser_game-auth && npm run typecheck && npm run build && npm test`
Expected: typecheck + build clean; all tests green (existing 33 + 6 new test files).
Re-run MCP `mcp__supabase__get_advisors` (security) — confirm no new criticals.

- [ ] **Step 4: Manual end-to-end smoke**

`npm run dev`. Verify: guest home shows AccountPanel CTA + dashboard + showcase; sign up → notice; (after confirm) sign in → AccountPanel shows email + "Синхронизация…"→"Синхронизировано"; play to change progress → cloud row updates; sign in elsewhere → progress pulls; conflict path shows ConflictModal. Without `.env`: everything except cloud works.

- [ ] **Step 5: Commit**

```bash
cd /c/Projects/browser_game-auth
git add src/ui/home/AccountPanel.tsx src/pages/home/HomePage.tsx
git commit -m "feat(home): account panel with cloud-sync status"
```

---

## Post-implementation
- Push the branch and open a PR on `github.com/denfry/ShadowLab`. Since this work is based on PR #1 (`portal-redesign-impl`), either target the PR #1 branch (stacked) or rebase onto `main` once PR #1 merges — confirm the base with the user before opening.
- Update memory: new `auth-cloud-home` project note (engine + worktree + PR), and link it to [[architecture-decisions]] and [[portal-redesign-direction]].
```
