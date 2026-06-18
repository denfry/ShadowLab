import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore, type ActiveToast } from '@/stores/useToastStore';
import { cx } from '@/core/utils';

const toneByKind: Record<ActiveToast['kind'], string> = {
  info: 'border-accent/40',
  success: 'border-good/50',
  achievement: 'border-accent2/50',
  warning: 'border-warn/50',
  error: 'border-bad/50',
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-panel/95 p-3 text-left shadow-panel backdrop-blur',
              toneByKind[t.kind],
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-2 text-lg">
              {t.icon ?? '•'}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-medium text-ink">{t.title}</span>
              {t.message && <span className="block truncate text-xs text-muted">{t.message}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
