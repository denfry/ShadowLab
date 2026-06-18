import { cx } from '@/core/utils';

interface ProgressBarProps {
  value: number; // 0..1
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  className?: string;
  showTrack?: boolean;
}

const tones: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  accent: 'bg-accent',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
};

export function ProgressBar({ value, tone = 'accent', className, showTrack = true }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full', showTrack && 'bg-bg-2', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${pct}%`, boxShadow: '0 0 12px -2px currentColor' }}
      />
    </div>
  );
}
