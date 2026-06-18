import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameDefinition } from '@/types/game-module';
import { IconPlay } from '@/ui/icons';

interface GameCardProps {
  def: GameDefinition;
  index?: number;
}

const motifByTheme: Record<GameDefinition['theme'], string> = {
  colony:
    'radial-gradient(120% 120% at 20% 0%, rgb(var(--accent)/0.35), transparent 55%), repeating-linear-gradient(135deg, rgb(var(--accent)/0.10) 0 10px, transparent 10px 20px)',
  shadow:
    'radial-gradient(120% 120% at 80% 0%, rgb(var(--accent)/0.32), transparent 55%), repeating-linear-gradient(90deg, rgb(var(--accent-2)/0.10) 0 2px, transparent 2px 8px)',
};

export function GameCard({ def, index = 0 }: GameCardProps) {
  const soon = def.status === 'soon';

  return (
    <motion.div
      data-theme={def.theme}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/games/${def.id}`}
        className="group block overflow-hidden rounded-2xl border border-edge/70 bg-panel/60 transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/50 hover:shadow-glow"
      >
        {/* Cover */}
        <div className="scanlines relative h-44 overflow-hidden">
          <div className="absolute inset-0" style={{ background: motifByTheme[def.theme] }} />
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/30 to-transparent" />
          <span className="absolute left-4 top-4 chip">{def.theme === 'colony' ? 'STRATEGY' : 'DETECTIVE'}</span>
          {soon && <span className="absolute right-4 top-4 chip border-warn/50 text-warn">SOON</span>}
          <span
            className="absolute bottom-3 right-4 font-display text-6xl font-bold text-ink/10 transition-transform duration-500 group-hover:scale-110"
            aria-hidden
          >
            {def.theme === 'colony' ? '◣' : '◈'}
          </span>
        </div>

        {/* Body */}
        <div className="p-5">
          <h3 className="font-display text-xl font-semibold tracking-wide text-ink neon-text">
            {def.title}
          </h3>
          <p className="mt-1 text-sm text-muted">{def.tagline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {def.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md bg-bg-2 px-2 py-0.5 font-mono text-[0.65rem] text-muted">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 font-display text-sm text-accent">
            <IconPlay width={16} height={16} />
            <span className="tracking-wide">{soon ? 'Скоро' : 'Открыть'}</span>
            <span className="ml-auto translate-x-0 text-muted transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
