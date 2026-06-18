import type { ColonyHudColonist, JobType } from '../../domain/types';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { TRAITS } from '../../domain/traits';
import { cx } from '@/core/utils';

const JOBS: { id: JobType; label: string }[] = [
  { id: 'build', label: 'Стройка' },
  { id: 'farm', label: 'Ферма' },
  { id: 'woodcut', label: 'Рубка' },
  { id: 'research', label: 'Наука' },
  { id: 'tailor', label: 'Пошив' },
];

export function Inspector({
  colonist,
  onSetPriority,
}: {
  colonist: ColonyHudColonist;
  onSetPriority: (job: JobType, value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg text-ink">{colonist.name}</p>
          {colonist.clothed && <span className="font-mono text-[0.55rem] text-accent">🧥 одет</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {colonist.traits.map((t) => (
            <span key={t} className="rounded-md border border-edge/60 px-1.5 py-0.5 font-mono text-[0.55rem] text-muted">
              {TRAITS[t]?.name ?? t}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <NeedBar label="Голод" value={colonist.hunger} invert />
        <NeedBar label="Усталость" value={colonist.fatigue} invert />
        <NeedBar label="Здоровье" value={colonist.health} />
        <NeedBar label="Холод" value={colonist.cold} invert />
      </div>

      <div>
        <p className="label-mono mb-1">Приоритеты работ</p>
        {JOBS.map((j) => (
          <div key={j.id} className="flex items-center gap-2 py-0.5">
            <span className="flex-1 text-xs text-ink">{j.label}</span>
            {[0, 1, 2, 3].map((v) => (
              <button
                key={v}
                onClick={() => onSetPriority(j.id, v)}
                className={cx(
                  'h-6 w-6 rounded-md border font-mono text-xs',
                  colonist.priorities[j.id] === v
                    ? 'border-accent/60 bg-accent/20 text-accent'
                    : 'border-edge/50 text-muted hover:text-ink',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const tone = invert ? (value > 70 ? 'warn' : 'accent') : value < 35 ? 'warn' : 'good';
  return (
    <div>
      <div className="flex justify-between font-mono text-[0.55rem] text-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <ProgressBar value={value / 100} tone={tone as 'good' | 'warn' | 'accent'} />
    </div>
  );
}
