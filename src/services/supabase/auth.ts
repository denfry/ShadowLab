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
