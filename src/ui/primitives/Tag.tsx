import type { ReactNode } from 'react';
import { cx } from '@/core/utils';

export type Tone = 'accent' | 'accent2' | 'good' | 'warn' | 'muted';

const toneCls: Record<Tone, string> = {
  accent: 'border-accent/30 bg-accent/10 text-accent',
  accent2: 'border-accent2/30 bg-accent2/10 text-accent2',
  good: 'border-good/30 bg-good/10 text-good',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  muted: 'border-edge/60 bg-panel/50 text-muted',
};

export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em]',
        toneCls[tone],
      )}
    >
      {children}
    </span>
  );
}
