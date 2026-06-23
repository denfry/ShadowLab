import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { motionAllowed } from '@/ui/motion';

/** True when ambient/idle motion may run, honoring both the OS media query and the in-app toggle. */
export function useMotionAllowed(): boolean {
  const settingReduced = useSettingsStore((s) => s.reducedMotion);
  const [prefersReduced, setPrefersReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return motionAllowed(prefersReduced, settingReduced);
}
