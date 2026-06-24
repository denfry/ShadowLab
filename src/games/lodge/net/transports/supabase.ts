import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Transport, NetMessage, PeerInfo } from '../types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function supabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

export class SupabaseBroadcastTransport implements Transport {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private msgCbs: ((m: NetMessage) => void)[] = [];
  private presCbs: ((p: PeerInfo[]) => void)[] = [];

  constructor(public selfId: string, private name: string, private code: string) {}

  async connect(): Promise<void> {
    if (!URL || !ANON) throw new Error('Supabase env not configured');
    this.client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
    const channel = this.client.channel('lodge:' + this.code, {
      config: { broadcast: { self: false }, presence: { key: this.selfId } },
    });
    this.channel = channel;
    channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
      for (const cb of [...this.msgCbs]) cb(payload as NetMessage);
    });
    channel.on('presence', { event: 'sync' }, () => this.emitPresence());
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ id: this.selfId, name: this.name });
          resolve();
        }
      });
    });
  }

  disconnect(): void {
    if (this.channel) void this.client?.removeChannel(this.channel);
    this.channel = null;
  }

  send(msg: NetMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'msg', payload: msg });
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.msgCbs.push(cb);
    return () => { this.msgCbs = this.msgCbs.filter((f) => f !== cb); };
  }

  onPresence(cb: (p: PeerInfo[]) => void): () => void {
    this.presCbs.push(cb);
    return () => { this.presCbs = this.presCbs.filter((f) => f !== cb); };
  }

  private emitPresence(): void {
    const state = this.channel?.presenceState() ?? {};
    const list: PeerInfo[] = [];
    for (const key of Object.keys(state)) {
      const metas = state[key] as Array<{ id?: string; name?: string }>;
      const meta = metas[0] ?? {};
      list.push({ id: meta.id ?? key, name: meta.name ?? 'Игрок' });
    }
    for (const cb of [...this.presCbs]) cb(list);
  }
}
