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
