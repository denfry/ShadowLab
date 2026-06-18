import { useEffect } from 'react';

export type ThemeName = 'portal' | 'colony' | 'shadow';

/** Sets the active palette via [data-theme] on <html>, restoring 'portal' on
 *  unmount. Drives the per-game CSS-variable swap. */
export function usePageTheme(theme: ThemeName): void {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme ?? 'portal';
    root.dataset.theme = theme;
    return () => {
      root.dataset.theme = previous;
    };
  }, [theme]);
}
