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
      appBus.emit('auth:change', { userId: null });
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
    set({ status: 'guest', user: null, session: null, pending: false, error: null, notice: null, authModalOpen: false });
    appBus.emit('auth:change', { userId: null });
  },

  clearFeedback: () => set({ error: null, notice: null }),
  openAuthModal: () => set({ authModalOpen: true, error: null, notice: null }),
  closeAuthModal: () => set({ authModalOpen: false }),
}));
