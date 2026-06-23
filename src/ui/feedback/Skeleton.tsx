import { cx } from '@/core/utils';

/** Shimmer loading block. Honors reduced-motion via the global gate (animation neutralized). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-shimmer rounded-lg bg-[length:200%_100%]',
        '[background-image:linear-gradient(90deg,rgb(var(--panel)/0.6),rgb(var(--panel-2)/0.9),rgb(var(--panel)/0.6))]',
        className,
      )}
    />
  );
}
