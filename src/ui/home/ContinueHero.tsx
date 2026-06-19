import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameDefinition } from '@/types/game-module';
import type { ContinueEntry } from '@/pages/home/continueModel';
import { EMBLEM } from '@/ui/game/genre';
import { Button } from '@/ui/primitives/Button';
import { Tag } from '@/ui/primitives/Tag';
import { IconPlay } from '@/ui/icons';

/** Resume-first hero: a large poster of the most-recent game, or a featured spotlight for new players. */
export function ContinueHero({ entry, fallbackGame }: { entry: ContinueEntry | null; fallbackGame: GameDefinition }) {
  const game = entry?.def ?? fallbackGame;
  const resuming = Boolean(entry);
  const to = resuming ? `/play/${game.id}?slot=${entry!.save.slot}` : `/games/${game.id}`;
  const themeTone = game.theme === 'colony' ? 'good' : 'accent2';

  return (
    <section data-theme={game.theme} className="hero-surface scanlines p-8 md:p-12">
      <div className="absolute -right-24 -top-24 h-72 w-72 animate-float rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-accent2/10 blur-3xl" />
      <motion.div
        className="relative max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="mb-4 inline-flex">
          <Tag tone={themeTone}>{resuming ? 'продолжить' : 'в центре внимания'}</Tag>
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-wide text-ink neon-text md:text-6xl">
          {game.title}
        </h1>
        <p className="mt-3 font-display text-lg text-accent">{game.tagline}</p>
        {resuming && <p className="mt-1 font-mono text-xs text-muted">{entry!.save.label}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={to}>
            <Button size="lg" variant="solid" icon={<IconPlay width={18} height={18} />}>
              {resuming ? 'Продолжить' : 'Играть'}
            </Button>
          </Link>
          <Link to="/games">
            <Button size="lg" variant="ghost">
              Все игры
            </Button>
          </Link>
        </div>
      </motion.div>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 right-4 font-display text-[12rem] font-bold leading-none text-ink/[0.05]"
      >
        {EMBLEM[game.theme]}
      </span>
    </section>
  );
}
