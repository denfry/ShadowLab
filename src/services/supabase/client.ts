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
