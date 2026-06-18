import { ProgressBar } from '@/ui/primitives/ProgressBar';

interface LoadingScreenProps {
  progress?: number; // 0..1, omit for indeterminate
  label?: string;
  hint?: string;
}

export function LoadingScreen({ progress, label = 'Загрузка', hint }: LoadingScreenProps) {
  return (
    <div className="scanlines grid min-h-[60vh] place-items-center">
      <div className="w-[min(90vw,420px)] text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center">
          <span className="absolute h-16 w-16 animate-ping rounded-full bg-accent/20" />
          <span className="grid h-12 w-12 animate-spin place-items-center rounded-xl border-2 border-accent/50 border-t-transparent" />
        </div>
        <p className="mb-2 font-display text-lg tracking-wide text-ink neon-text">{label}</p>
        {hint && <p className="mb-5 font-mono text-xs text-muted">{hint}</p>}
        {progress !== undefined ? (
          <ProgressBar value={progress} />
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-2">
            <div className="h-full w-1/3 animate-[scan_1.2s_linear_infinite] rounded-full bg-accent" />
          </div>
        )}
      </div>
    </div>
  );
}
