import type { ReactNode } from 'react';
import { cx } from '@/core/utils';
import type { Tone } from './Tag';

const toneCls: Record<Tone, string> = {
  accent: 'border-accent/25 bg-accent/10 text-accent',
  accent2: 'border-accent2/25 bg-accent2/10 text-accent2',
  good: 'border-good/25 bg-good/10 text-good',
  warn: 'border-warn/25 bg-warn/10 text-warn',
  muted: 'border-edge/60 bg-panel/40 text-muted',
};

export function StatChip({ icon, label, tone = 'accent' }: { icon?: ReactNode; label: string; tone?: Tone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[0.7rem] tracking-wide',
        toneCls[tone],
      )}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </span>
  );
}
