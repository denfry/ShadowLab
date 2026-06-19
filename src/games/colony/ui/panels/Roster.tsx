import type { ColonyHudColonist } from '../../domain/types';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { SKILL_NAMES } from '../../domain/skills';

const TASK_LABEL: Record<string, string> = {
  idle: 'свободен', goto_work: 'идёт', work: 'работает',
  goto_eat: 'идёт есть', eat: 'ест', goto_sleep: 'идёт спать', sleep: 'спит',
};

export function Roster({ colonists, onSelect }: { colonists: ColonyHudColonist[]; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      {colonists.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="panel-inset flex w-full items-center gap-2 p-2 text-left hover:border-accent/50"
        >
          <span className="w-16 truncate font-display text-sm text-ink">{c.name}</span>
          <span className="w-20 font-mono text-[0.6rem] text-muted">{TASK_LABEL[c.task] ?? c.task}</span>
          <span className="flex-1">
            <span className="mb-0.5 block font-mono text-[0.55rem] text-muted">♥ {c.health}</span>
            <ProgressBar value={c.health / 100} tone="good" />
          </span>
          <span className="w-14 font-mono text-[0.55rem] text-muted">
            {SKILL_NAMES[c.topSkill.id].slice(0, 4)} {c.topSkill.level}
          </span>
        </button>
      ))}
    </div>
  );
}
