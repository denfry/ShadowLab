import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/core/utils';

type Variant = 'primary' | 'solid' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const base =
  'group relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-display ' +
  'font-medium tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 hover:shadow-glow ' +
    'active:translate-y-px',
  solid:
    'border border-transparent text-bg shadow-e2 hover:brightness-110 active:translate-y-px ' +
    '[background:linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent)/0.75))]',
  danger:
    'bg-bad/10 text-bad border border-bad/40 hover:bg-bad/20 active:translate-y-px',
  ghost:
    'bg-transparent text-ink/80 border border-edge/70 hover:border-accent/50 hover:text-ink ' +
    'hover:bg-panel/60',
  subtle: 'bg-panel/60 text-muted border border-transparent hover:text-ink hover:bg-panel',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});
