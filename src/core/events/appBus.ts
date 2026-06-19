import { EventBus } from './EventBus';

export interface ToastPayload {
  id?: string;
  kind: 'info' | 'success' | 'achievement' | 'warning' | 'error';
  title: string;
  message?: string;
  icon?: string;
}

export interface AppEvents extends Record<string, unknown> {
  toast: ToastPayload;
  'achievement:unlocked': { id: string; title: string };
  'save:written': { gameId: string; slot: number };
  'auth:change': { userId: string | null };
  'theme:change': string;
}

/** Global portal-level event bus (toasts, cross-cutting notifications). */
export const appBus = new EventBus<AppEvents>();

export const toast = (payload: ToastPayload): void => appBus.emit('toast', payload);
