import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameContext } from '@/types/game-module';
import { Button } from '@/ui/primitives/Button';
import { cx } from '@/core/utils';
import { CASE_SLOTS, CaseManager, FIRST_CASE_ID, recordKey } from '../systems/CaseManager';
import { scoreCase } from '../systems/ScoringSystem';
import type { CasePhase, CaseProgress, DetectiveCase, Evidence, Suspect } from '../domain/types';
import { ConnectionBoard } from './ConnectionBoard';
import { FakeTerminal } from './FakeTerminal';

const PHASES: { key: CasePhase; label: string }[] = [
  { key: 'intro', label: 'Дело' },
  { key: 'investigate', label: 'Улики' },
  { key: 'questions', label: 'Вопросы' },
  { key: 'accuse', label: 'Вывод' },
  { key: 'result', label: 'Итог' },
];

export function ShadowTraceGame({ ctx }: { ctx: GameContext }) {
  const caseId = ctx.params.case && CASE_SLOTS[ctx.params.case] !== undefined ? ctx.params.case : FIRST_CASE_ID;
  const [caseData, setCaseData] = useState<DetectiveCase | null>(null);
  const [progress, setProgress] = useState<CaseProgress | null>(null);
  const readyRef = useRef(false);

  // Load case content + (optionally) saved progress.
  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await CaseManager.load(caseId);
      let prog = CaseManager.freshProgress(caseId);
      if (ctx.mode === 'load') {
        const saved = (await ctx.save.load(ctx.slot)) as CaseProgress | null;
        if (saved && saved.caseId === caseId) prog = saved;
      }
      if (!alive) return;
      setCaseData(data);
      setProgress(prog);
      readyRef.current = true;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const update = (mutate: (p: CaseProgress) => CaseProgress) => {
    setProgress((prev) => {
      if (!prev) return prev;
      const next = mutate(structuredClone(prev));
      if (readyRef.current && caseData) {
        ctx.save.autosave(next, `${caseData.title} · ${labelFor(next.phase)}`);
      }
      return next;
    });
  };

  if (!caseData || !progress) {
    return null; // LoadingScreen is shown by GameCanvasWrapper until 'running'
  }

  const goPhase = (phase: CasePhase) => update((p) => ({ ...p, phase }));

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto px-4 pb-10 pt-20 md:px-8">
      <div className="mx-auto max-w-5xl">
        <Stepper current={progress.phase} />

        <AnimatePresence mode="wait">
          <motion.div
            key={progress.phase}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {progress.phase === 'intro' && <Intro caseData={caseData} onStart={() => goPhase('investigate')} />}
            {progress.phase === 'investigate' && (
              <Investigate
                caseData={caseData}
                progress={progress}
                ctx={ctx}
                update={update}
                onNext={() => goPhase('questions')}
              />
            )}
            {progress.phase === 'questions' && (
              <Questions caseData={caseData} progress={progress} update={update} onBack={() => goPhase('investigate')} onNext={() => goPhase('accuse')} />
            )}
            {progress.phase === 'accuse' && (
              <Accuse
                caseData={caseData}
                progress={progress}
                update={update}
                ctx={ctx}
                onBack={() => goPhase('questions')}
              />
            )}
            {progress.phase === 'result' && (
              <Result caseData={caseData} progress={progress} ctx={ctx} onReplay={() => setProgress(CaseManager.freshProgress(caseId))} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function labelFor(phase: CasePhase): string {
  return PHASES.find((p) => p.key === phase)?.label ?? '';
}

function Stepper({ current }: { current: CasePhase }) {
  const idx = PHASES.findIndex((p) => p.key === current);
  return (
    <div className="mb-6 flex items-center gap-2">
      {PHASES.map((p, i) => (
        <div key={p.key} className="flex items-center gap-2">
          <span
            className={cx(
              'flex h-7 items-center gap-2 rounded-full border px-3 font-mono text-[0.65rem] uppercase tracking-wider',
              i === idx
                ? 'border-accent/60 bg-accent/15 text-accent'
                : i < idx
                  ? 'border-edge/60 text-muted'
                  : 'border-edge/40 text-muted/50',
            )}
          >
            {i < idx ? '✓' : i + 1} {p.label}
          </span>
          {i < PHASES.length - 1 && <span className="h-px w-3 bg-edge/60" />}
        </div>
      ))}
    </div>
  );
}

function Intro({ caseData, onStart }: { caseData: DetectiveCase; onStart: () => void }) {
  return (
    <div className="scanlines panel p-7">
      <span className="chip mb-4">дело · {caseData.difficulty}</span>
      <h1 className="font-display text-3xl font-bold text-ink neon-text">{caseData.title}</h1>
      <p className="mt-3 text-muted">{caseData.synopsis}</p>
      <div className="mt-6 space-y-3 border-l-2 border-accent/40 pl-4">
        {caseData.intro.map((line, i) => (
          <p key={i} className={cx('text-sm', i === caseData.intro.length - 1 ? 'font-mono text-[0.7rem] text-warn' : 'text-ink/80')}>
            {line}
          </p>
        ))}
      </div>
      <Button className="mt-7" size="lg" onClick={onStart}>
        Начать расследование →
      </Button>
    </div>
  );
}

function Investigate({
  caseData,
  progress,
  ctx,
  update,
  onNext,
}: {
  caseData: DetectiveCase;
  progress: CaseProgress;
  ctx: GameContext;
  update: (m: (p: CaseProgress) => CaseProgress) => void;
  onNext: () => void;
}) {
  const [tab, setTab] = useState<'evidence' | 'board' | 'terminal'>('evidence');
  const [openId, setOpenId] = useState<string>(progress.discovered[0] ?? caseData.evidence[0].id);

  const open = (e: Evidence) => {
    setOpenId(e.id);
    if (!progress.discovered.includes(e.id)) {
      update((p) => {
        const discovered = [...p.discovered, e.id];
        if (discovered.length === caseData.evidence.length) {
          ctx.achievements.unlock('shadow.all_evidence');
        }
        return { ...p, discovered };
      });
    }
  };

  const toggleConn = (evidenceId: string, suspectId: string) =>
    update((p) => {
      const exists = p.connections.some(
        (c) =>
          (c.fromId === evidenceId && c.toId === suspectId) ||
          (c.fromId === suspectId && c.toId === evidenceId),
      );
      const connections = exists
        ? p.connections.filter(
            (c) => !((c.fromId === evidenceId && c.toId === suspectId) || (c.fromId === suspectId && c.toId === evidenceId)),
          )
        : [...p.connections, { fromId: evidenceId, toId: suspectId }];
      return { ...p, connections };
    });

  const openEvidence = caseData.evidence.find((e) => e.id === openId)!;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['evidence', 'board', 'terminal'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'rounded-xl border px-4 py-2 font-display text-sm tracking-wide',
              tab === t ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge/60 text-muted hover:text-ink',
            )}
          >
            {t === 'evidence' ? 'Улики' : t === 'board' ? 'Доска связей' : 'Терминал'}
          </button>
        ))}
        <span className="ml-auto chip">
          изучено {progress.discovered.length}/{caseData.evidence.length}
        </span>
      </div>

      {tab === 'evidence' && (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {caseData.evidence.map((e) => (
              <button
                key={e.id}
                onClick={() => open(e)}
                className={cx(
                  'w-full rounded-xl border p-3 text-left transition-all',
                  e.id === openId ? 'border-accent/50 bg-accent/10' : 'border-edge/60 hover:border-accent/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{kindGlyph(e.kind)}</span>
                  <span className="font-display text-sm text-ink">{e.title}</span>
                  {progress.discovered.includes(e.id) && <span className="ml-auto text-[0.6rem] text-accent">✓</span>}
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted">{e.summary}</p>
              </button>
            ))}
          </div>
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="chip">{openEvidence.kind}</span>
              <h3 className="font-display text-lg text-ink">{openEvidence.title}</h3>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-ink/85">
              {openEvidence.content}
            </pre>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {openEvidence.relatedSuspectIds.map((sid) => (
                <span key={sid} className="rounded-md bg-bg-2 px-2 py-0.5 font-mono text-[0.65rem] text-muted">
                  ↪ {caseData.suspects.find((s) => s.id === sid)?.name ?? sid}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'board' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <ConnectionBoard
            evidence={caseData.evidence.map((e) => ({ id: e.id, label: e.title }))}
            suspects={caseData.suspects.map((s) => ({ id: s.id, label: s.name }))}
            connections={progress.connections}
            onToggle={toggleConn}
          />
          <div className="space-y-2">
            {caseData.suspects.map((s) => (
              <InterrogationCard key={s.id} suspect={s} discovered={progress.discovered} caseData={caseData} />
            ))}
          </div>
        </div>
      )}

      {tab === 'terminal' && <FakeTerminal commands={caseData.terminal} />}

      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={onNext}>
          К вопросам →
        </Button>
      </div>
    </div>
  );
}

function Questions({
  caseData,
  progress,
  update,
  onBack,
  onNext,
}: {
  caseData: DetectiveCase;
  progress: CaseProgress;
  update: (m: (p: CaseProgress) => CaseProgress) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const answeredAll = caseData.questions.every((q) => progress.answers[q.id]);
  return (
    <div className="space-y-4">
      {caseData.questions.map((q, i) => (
        <div key={q.id} className="panel p-5">
          <p className="mb-3 font-display text-ink">
            <span className="mr-2 font-mono text-accent">{String(i + 1).padStart(2, '0')}</span>
            {q.text}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((opt) => {
              const selected = progress.answers[q.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => update((p) => ({ ...p, answers: { ...p.answers, [q.id]: opt.id } }))}
                  className={cx(
                    'rounded-xl border px-4 py-2.5 text-left text-sm transition-all',
                    selected ? 'border-accent/60 bg-accent/10 text-accent' : 'border-edge/60 text-ink/80 hover:border-accent/40',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← к уликам
        </Button>
        <Button size="lg" disabled={!answeredAll} onClick={onNext}>
          {answeredAll ? 'К финальному выводу →' : 'ответьте на все вопросы'}
        </Button>
      </div>
    </div>
  );
}

function Accuse({
  caseData,
  progress,
  update,
  ctx,
  onBack,
}: {
  caseData: DetectiveCase;
  progress: CaseProgress;
  update: (m: (p: CaseProgress) => CaseProgress) => void;
  ctx: GameContext;
  onBack: () => void;
}) {
  const [culprit, setCulprit] = useState(progress.accusation?.culpritId ?? '');
  const [fake, setFake] = useState(progress.accusation?.fakeEvidenceId ?? '');

  const submit = () => {
    const accusation = { culpritId: culprit, fakeEvidenceId: fake };
    const result = scoreCase(caseData, { ...progress, accusation });

    // Persist records (best score + solved flag).
    ctx.records.set(recordKey.caseBestScore(caseData.id), result.score, 'max');
    if (result.accusedCorrectly) ctx.records.set(recordKey.caseSolved(caseData.id), 1, 'max');

    // Achievements on completion.
    ctx.achievements.unlock('shadow.first_case');
    if (result.accusedCorrectly && result.foundFake && result.correctAnswers === result.totalQuestions) {
      ctx.achievements.unlock('shadow.flawless');
    }
    if (result.rank === 'S') ctx.achievements.unlock('shadow.perfect_rank');
    const solvedCount = Object.keys(CASE_SLOTS).filter((id) => ctx.records.get(recordKey.caseSolved(id)) === 1).length;
    if (solvedCount >= 2) ctx.achievements.unlock('shadow.two_cases');

    update((p) => ({ ...p, accusation, result, phase: 'result' }));
    void ctx.save.save(ctx.slot, { ...progress, accusation, result, phase: 'result' }, `${caseData.title} · раскрыто (${result.rank})`);
  };

  return (
    <div className="space-y-5">
      <div className="panel p-6">
        <h3 className="mb-1 font-display text-xl text-ink">Финальный вывод</h3>
        <p className="mb-5 text-sm text-muted">Назови виновного и определи подброшенную улику.</p>

        <p className="label-mono mb-2">Виновный</p>
        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {caseData.suspects.map((s) => (
            <button
              key={s.id}
              onClick={() => setCulprit(s.id)}
              className={cx(
                'rounded-xl border p-3 text-left transition-all',
                culprit === s.id ? 'border-bad/60 bg-bad/10' : 'border-edge/60 hover:border-bad/40',
              )}
            >
              <p className="font-display text-sm text-ink">{s.name}</p>
              <p className="text-[0.7rem] text-muted">{s.role}</p>
            </button>
          ))}
        </div>

        <p className="label-mono mb-2">Фальшивая улика</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {caseData.evidence.map((e) => (
            <button
              key={e.id}
              onClick={() => setFake(e.id)}
              className={cx(
                'rounded-xl border p-3 text-left transition-all',
                fake === e.id ? 'border-warn/60 bg-warn/10' : 'border-edge/60 hover:border-warn/40',
              )}
            >
              <p className="font-display text-sm text-ink">{e.title}</p>
              <p className="text-[0.7rem] text-muted">{kindGlyph(e.kind)} {e.kind}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← к вопросам
        </Button>
        <Button size="lg" variant="danger" disabled={!culprit || !fake} onClick={submit}>
          Предъявить обвинение
        </Button>
      </div>
    </div>
  );
}

const RANK_TONE: Record<string, string> = {
  S: 'text-accent',
  A: 'text-good',
  B: 'text-good',
  C: 'text-warn',
  F: 'text-bad',
};

function Result({
  caseData,
  progress,
  ctx,
  onReplay,
}: {
  caseData: DetectiveCase;
  progress: CaseProgress;
  ctx: GameContext;
  onReplay: () => void;
}) {
  const r = useMemo(() => progress.result ?? scoreCase(caseData, progress), [caseData, progress]);
  return (
    <div className="space-y-5">
      <motion.div
        className="scanlines panel p-8 text-center"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <p className="label-mono">рейтинг расследования</p>
        <p className={cx('my-2 font-display text-7xl font-bold neon-text', RANK_TONE[r.rank])}>{r.rank}</p>
        <p className="font-mono text-sm text-muted">{r.score} / 100 очков</p>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2 text-left">
          <Metric ok={r.accusedCorrectly} label="Виновный определён" />
          <Metric ok={r.foundFake} label="Фальшивая улика найдена" />
          <Metric ok={r.correctAnswers === r.totalQuestions} label={`Вопросы ${r.correctAnswers}/${r.totalQuestions}`} />
          <Metric ok={r.correctConnections === r.totalConnections} label={`Связи ${r.correctConnections}/${r.totalConnections}`} />
        </div>
      </motion.div>

      <div className="panel p-6">
        <p className="label-mono mb-2">Что произошло</p>
        <p className="text-sm leading-relaxed text-ink/85">{caseData.solution.whatHappened}</p>
        <p className="mt-3 font-mono text-xs text-muted">
          Виновный: {caseData.suspects.find((s) => s.id === caseData.solution.culpritId)?.name} · Подброшено:{' '}
          {caseData.evidence.find((e) => e.id === caseData.solution.fakeEvidenceId)?.title}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" variant="ghost" onClick={onReplay}>
          Пройти заново
        </Button>
        <Button size="lg" onClick={() => ctx.exit()}>
          На портал
        </Button>
      </div>
    </div>
  );
}

function Metric({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge/50 bg-bg-2/50 px-3 py-2">
      <span className={ok ? 'text-good' : 'text-bad'}>{ok ? '✓' : '✕'}</span>
      <span className="text-xs text-ink/80">{label}</span>
    </div>
  );
}

function InterrogationCard({
  suspect,
  discovered,
  caseData,
}: {
  suspect: Suspect;
  discovered: string[];
  caseData: DetectiveCase;
}) {
  const [open, setOpen] = useState(false);
  const statements = suspect.statements ?? [];
  const evidenceTitle = (id: string) => caseData.evidence.find((e) => e.id === id)?.title ?? id;

  return (
    <div className="panel-inset p-3">
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-bg-2 text-xs">🕵</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm text-ink">{suspect.name}</span>
          <span className="block text-[0.7rem] text-muted">{suspect.role}</span>
        </span>
        {statements.length > 0 && <span className="text-muted">{open ? '▾' : '▸'}</span>}
      </button>
      <p className="mt-1 font-mono text-[0.62rem] text-muted">алиби: {suspect.alibi}</p>

      {open && statements.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-accent/30 pl-2">
          {statements.map((st, i) => {
            const locked = st.requiresEvidenceId && !discovered.includes(st.requiresEvidenceId);
            return locked ? (
              <p key={i} className="font-mono text-[0.62rem] text-muted/60">
                🔒 предъявите улику: «{evidenceTitle(st.requiresEvidenceId!)}»
              </p>
            ) : (
              <p key={i} className="text-[0.72rem] italic text-ink/85">
                «{st.line}»
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

function kindGlyph(kind: string): string {
  return { message: '✉️', log: '📄', image: '🖼️', note: '📝', object: '🪪' }[kind] ?? '•';
}
