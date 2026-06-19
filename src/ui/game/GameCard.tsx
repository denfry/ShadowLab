import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameDefinition } from '@/types/game-module';
import { SaveManager } from '@/services/save/SaveManager';
import { buildGameCardModel } from '@/ui/game/gameCardModel';
import { StatChip } from '@/ui/primitives/StatChip';
import { Tag } from '@/ui/primitives/Tag';

interface GameCardProps {
  def: GameDefinition;
  index?: number;
}

// Procedural poster art per theme. --accent / --accent-2 resolve under data-theme.
const coverByTheme: Record<GameDefinition['theme'], string> = {
  colony:
    'radial-gradient(85% 70% at 22% 8%, rgb(var(--accent)/0.40), transparent 58%), repeating-linear-gradient(135deg, rgb(var(--accent)/0.10) 0 9px, transparent 9px 20px), linear-gradient(180deg, rgb(var(--bg)), rgb(var(--bg-2)))',
  shadow:
    'radial-gradient(90% 70% at 78% 12%, rgb(var(--accent-2)/0.42), transparent 60%), radial-gradient(80% 70% at 18% 95%, rgb(var(--accent-2)/0.30), transparent 55%), linear-gradient(180deg, rgb(var(--bg)), rgb(var(--bg-2)))',
};

export function GameCard({ def, index = 0 }: GameCardProps) {
  const lastSave = SaveManager.lastPlayed(def.id);
  // Only colony exposes numeric records; shadow surfaces its save label (see gameCardModel).
  const records = {
    'colony.bestDay': SaveManager.getRecord('colony.bestDay'),
    'colony.victories': SaveManager.getRecord('colony.victories'),
  };
  const m = buildGameCardModel({ def, lastSave, records });
  const cta = m.state === 'in-progress' ? `▶ ${m.ctaLabel}` : `${m.ctaLabel} →`;
  const themeTone = def.theme === 'colony' ? 'good' : 'accent2';

  return (
    <motion.div
      data-theme={def.theme}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/games/${def.id}`}
        className="group block overflow-hidden rounded-2xl border border-edge/70 bg-panel/40 shadow-e1 transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/50 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {/* Poster */}
        <div className="scanlines relative h-60 overflow-hidden">
          <div
            className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ background: coverByTheme[def.theme] }}
          />
          <span
            aria-hidden
            className="absolute -bottom-4 right-2 font-display text-[7rem] font-bold leading-none text-ink/[0.06] transition-transform duration-500 group-hover:scale-110"
          >
            {m.emblem}
          </span>
          <span className="absolute left-4 top-4">
            <Tag tone={themeTone}>{m.genre}</Tag>
          </span>
          {/* bottom scrim with title + stats */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/70 to-transparent p-4 pt-10">
            <h3 className="font-display text-2xl font-bold tracking-wide text-ink neon-text">{m.title}</h3>
            <p className="mt-0.5 text-sm text-muted">{m.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.stats.map((s) => (
                <StatChip key={s.label} icon={s.icon} label={s.label} tone={s.tone === 'accent' ? themeTone : s.tone} />
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-edge/50 px-4 py-3">
          <span className="font-mono text-[0.7rem] tracking-wide text-muted">{m.metaTags.join(' · ')}</span>
          <span className="ml-auto font-display text-sm font-semibold tracking-wide text-accent transition-transform group-hover:translate-x-0.5">
            {cta}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
