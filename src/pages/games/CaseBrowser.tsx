import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SaveManager } from '@/services/save/SaveManager';
import { Button } from '@/ui/primitives/Button';
import { IconPlay } from '@/ui/icons';
import { cx } from '@/core/utils';

interface CaseSummary {
  id: string;
  title: string;
  tagline: string;
  difficulty: 'easy' | 'normal' | 'hard';
}

const rankFor = (score: number) =>
  score >= 95 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 45 ? 'C' : 'F';

const RANK_TONE: Record<string, string> = {
  S: 'text-accent',
  A: 'text-good',
  B: 'text-good',
  C: 'text-warn',
  F: 'text-bad',
};

const DIFF_LABEL: Record<string, string> = { easy: 'лёгкое', normal: 'обычное', hard: 'сложное' };

/** Portal-level case selector. Reads the same catalog the game loads at runtime,
 *  but stays decoupled from game internals (plain fetch + records). */
export function CaseBrowser() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/data/cases/index.json')
      .then((r) => r.json())
      .then(setCases)
      .catch(() => setCases([]));
  }, []);

  return (
    <div className="grid gap-3">
      {cases.map((c, idx) => {
        const slot = idx;
        const best = SaveManager.getRecord(`case.${c.id}.bestScore`);
        const solved = SaveManager.getRecord(`case.${c.id}.solved`) === 1;
        const save = SaveManager.getSlot('shadow-trace', slot);
        const payload = save?.payload as { phase?: string } | undefined;
        const inProgress = Boolean(payload?.phase && payload.phase !== 'result');

        return (
          <div key={c.id} className="panel flex flex-wrap items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bg-2 text-xl">
              {solved ? '🗂️' : '🔍'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg text-ink">{c.title}</h3>
                <span className="chip">{DIFF_LABEL[c.difficulty]}</span>
                {solved && <span className="font-mono text-[0.65rem] text-good">✓ раскрыто</span>}
              </div>
              <p className="text-sm text-muted">{c.tagline}</p>
            </div>

            {best > 0 && (
              <div className="text-center">
                <p className={cx('font-display text-2xl font-bold', RANK_TONE[rankFor(best)])}>{rankFor(best)}</p>
                <p className="font-mono text-[0.6rem] text-muted">{best}/100</p>
              </div>
            )}

            <div className="flex gap-2">
              {inProgress && (
                <Button size="sm" variant="ghost" onClick={() => navigate(`/play/shadow-trace?slot=${slot}&case=${c.id}`)}>
                  Продолжить
                </Button>
              )}
              <Button
                size="sm"
                icon={<IconPlay width={14} height={14} />}
                onClick={() => navigate(`/play/shadow-trace?new=1&slot=${slot}&case=${c.id}`)}
              >
                {solved ? 'Заново' : 'Расследовать'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
