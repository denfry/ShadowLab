import type { ReactNode } from 'react';

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

export function SectionTitle({ eyebrow, title, action }: SectionTitleProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-accent/80">{eyebrow}</p>
        )}
        <h2 className="font-display text-2xl font-semibold tracking-wide text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}
