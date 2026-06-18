import { useEffect, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { usePageTheme } from '@/ui/hooks/usePageTheme';
import { useMotionAllowed } from '@/ui/hooks/useMotionAllowed';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();
  usePageTheme('portal');

  // Single source of truth for ambient motion: drives a root attribute that CSS honors.
  const allowMotion = useMotionAllowed();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = allowMotion ? 'false' : 'true';
  }, [allowMotion]);

  return (
    <div className="min-h-screen">
      <Header onMenu={() => setDrawerOpen(true)} />

      <div className="mx-auto flex w-full max-w-[1400px] gap-0">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-edge/50 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              className="fixed inset-0 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-bg-2/80 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
              <motion.aside
                className="absolute left-0 top-0 h-full w-72 border-r border-edge/60 bg-bg"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              >
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative min-w-0 flex-1 px-4 py-6 md:px-8 md:py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 animate-drift opacity-60 [background:radial-gradient(40%_30%_at_80%_0%,rgb(var(--accent-2)/0.06),transparent_70%)]"
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
