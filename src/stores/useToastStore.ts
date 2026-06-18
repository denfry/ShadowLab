import { create } from 'zustand';
import type { ToastPayload } from '@/core/events/appBus';

export interface ActiveToast extends Required<Pick<ToastPayload, 'kind' | 'title'>> {
  id: string;
  message?: string;
  icon?: string;
}

interface ToastStore {
  toasts: ActiveToast[];
  push(payload: ToastPayload): void;
  dismiss(id: string): void;
}

let seq = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (payload) => {
    const id = payload.id ?? `t_${seq++}`;
    const toast: ActiveToast = {
      id,
      kind: payload.kind,
      title: payload.title,
      message: payload.message,
      icon: payload.icon,
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
