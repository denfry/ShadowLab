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
        {eyebrow && <p className="label-mono mb-1">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold tracking-wide text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}
