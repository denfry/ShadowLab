import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameContext } from '@/types/game-module';
import type { ColonyHudState, JobId, ResourceId, BuildingType } from '../domain/types';
import { BUILD_COST } from '../data/balance';
import { TECHS } from '../data/tech';
import { Button } from '@/ui/primitives/Button';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { Modal } from '@/ui/primitives/Modal';
import { cx } from '@/core/utils';
import { IconPause, IconPlay } from '@/ui/icons';

const RES_META: Record<ResourceId, { label: string; glyph: string; tone: 'good' | 'warn' | 'accent' }> = {
  food: { label: 'Еда', glyph: '🌾', tone: 'good' },
  wood: { label: 'Дерево', glyph: '🪵', tone: 'warn' },
  science: { label: 'Наука', glyph: '🔬', tone: 'accent' },
};

const JOB_META: Record<JobId, { label: string; glyph: string }> = {
  farmer: { label: 'Фермеры', glyph: '🌾' },
  lumberjack: { label: 'Лесорубы', glyph: '🪓' },
  researcher: { label: 'Учёные', glyph: '🔬' },
  idle: { label: 'Свободны', glyph: '💤' },
};

const WEATHER_GLYPH: Record<string, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️' };

export function ColonyHud({ ctx }: { ctx: GameContext }) {
  const [hud, setHud] = useState<ColonyHudState | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);

  useEffect(() => {
    const off = ctx.events.on('game:state', (s: ColonyHudState) => setHud(s));
    return () => off();
  }, [ctx]);

  if (!hud) return null;

  const cmd = (type: string, payload?: unknown) => ctx.events.emit('ui:command', { type, payload });
  const setSpeed = (value: number) => cmd('speed', { value });
  const build = (building: BuildingType) => cmd('build', { building });
  const assign = (job: JobId, dir: 1 | -1) => cmd('assign', { job, dir });

  return (
    <>
      {/* Top resource bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 z-10 px-4 md:px-8">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-2xl border border-edge/60 bg-panel/80 p-3 backdrop-blur">
          {(Object.keys(RES_META) as ResourceId[]).map((id) => {
            const r = hud.resources[id];
            const m = RES_META[id];
            return (
              <div key={id} className="min-w-[120px] flex-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-muted">
                    {m.glyph} {m.label}
                  </span>
                  <span className="text-ink">
                    {Math.floor(r.amount)}/{r.capacity}
                  </span>
                </div>
                <ProgressBar className="mt-1" value={r.amount / r.capacity} tone={m.tone} />
              </div>
            );
          })}
          <div className="flex items-center gap-3 border-l border-edge/50 pl-3 font-mono text-xs text-muted">
            <span>День {hud.day}</span>
            <span>{WEATHER_GLYPH[hud.weather.condition]} {hud.weather.temp}°</span>
            <span>{hud.phase === 'day' ? '🌞' : '🌙'}</span>
          </div>
        </div>
      </div>

      {/* Right control panel */}
      <div className="absolute bottom-4 right-4 top-32 z-10 hidden w-72 md:block">
        <div className="panel flex h-full flex-col gap-4 overflow-y-auto p-4">
          <Section title="Население">
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl text-ink">
                {hud.population}
                <span className="text-sm text-muted">/{hud.capacity}</span>
              </span>
              <div className="text-right font-mono text-[0.65rem] text-muted">
                <p>♥ здоровье {hud.avgHealth}</p>
                <p>☺ мораль {hud.avgMorale}</p>
              </div>
            </div>
            <button
              className="mt-2 w-full rounded-lg border border-edge/60 py-1.5 font-mono text-[0.65rem] text-muted hover:text-ink"
              onClick={() => setRosterOpen(true)}
            >
              открыть список жителей →
            </button>
          </Section>

          <Section title="Работы">
            {(['farmer', 'lumberjack', 'researcher', 'idle'] as JobId[]).map((job) => (
              <div key={job} className="flex items-center gap-2 py-1">
                <span className="flex-1 text-sm text-ink">
                  {JOB_META[job].glyph} {JOB_META[job].label}
                </span>
                <span className="w-6 text-center font-mono text-sm text-accent">{hud.jobs[job]}</span>
                {job !== 'idle' && (
                  <div className="flex gap-1">
                    <button className="h-6 w-6 rounded-md border border-edge/60 text-muted hover:text-ink" onClick={() => assign(job, -1)}>
                      −
                    </button>
                    <button className="h-6 w-6 rounded-md border border-edge/60 text-muted hover:text-ink" onClick={() => assign(job, 1)}>
                      +
                    </button>
                  </div>
                )}
              </div>
            ))}
          </Section>

          <Section title="Строительство">
            <div className="grid grid-cols-3 gap-2">
              {(['farm', 'house', 'lab'] as BuildingType[]).map((b) => (
                <button
                  key={b}
                  onClick={() => build(b)}
                  className="rounded-xl border border-edge/60 p-2 text-center transition-all hover:border-accent/50"
                >
                  <span className="block text-lg">{b === 'farm' ? '🌾' : b === 'house' ? '🏠' : '🔬'}</span>
                  <span className="block font-mono text-[0.6rem] text-muted">{BUILD_COST[b].wood}🪵</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Технологии">
            <div className="space-y-1.5">
              {TECHS.map((t) => {
                const done = hud.researched.includes(t.id);
                const locked = (t.requires ?? []).some((r) => !hud.researched.includes(r));
                const afford = hud.science >= t.cost;
                return (
                  <button
                    key={t.id}
                    disabled={done || locked || !afford}
                    onClick={() => cmd('research', { techId: t.id })}
                    className={cx(
                      'w-full rounded-lg border p-2 text-left transition-all',
                      done
                        ? 'border-accent/40 bg-accent/10'
                        : locked
                          ? 'cursor-not-allowed border-edge/40 opacity-50'
                          : afford
                            ? 'border-edge/60 hover:border-accent/50'
                            : 'border-edge/40 opacity-70',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xs text-ink">{t.name}</span>
                      <span className="font-mono text-[0.6rem] text-muted">
                        {done ? '✓' : locked ? '🔒' : `${t.cost}🔬`}
                      </span>
                    </div>
                    <p className="text-[0.62rem] text-muted">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Журнал">
            <div className="space-y-1">
              {hud.log.map((l, i) => (
                <p
                  key={i}
                  className={cx(
                    'font-mono text-[0.65rem]',
                    l.tone === 'good' ? 'text-good' : l.tone === 'bad' ? 'text-bad' : 'text-muted',
                  )}
                >
                  д{l.day}: {l.text}
                </p>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Speed controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-2xl border border-edge/60 bg-panel/80 p-1.5 backdrop-blur">
        <button
          className={cx('grid h-9 w-9 place-items-center rounded-xl', hud.speed === 0 ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink')}
          onClick={() => setSpeed(0)}
          aria-label="Пауза"
        >
          <IconPause width={16} height={16} />
        </button>
        {[1, 2, 3].map((sp) => (
          <button
            key={sp}
            className={cx(
              'grid h-9 w-9 place-items-center rounded-xl font-mono text-sm',
              hud.speed === sp ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink',
            )}
            onClick={() => setSpeed(sp)}
          >
            {sp === 1 ? <IconPlay width={14} height={14} /> : `${sp}×`}
          </button>
        ))}
      </div>

      {/* End overlay */}
      {hud.gameOver && (
        <motion.div
          className="absolute inset-0 z-30 grid place-items-center bg-bg/85 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="panel max-w-sm p-8 text-center">
            <p className="mb-1 font-display text-5xl">{hud.victory ? '🏆' : '💀'}</p>
            <h2 className={cx('font-display text-2xl font-bold', hud.victory ? 'text-good' : 'text-bad')}>
              {hud.victory ? 'Колония процветает' : 'Колония пала'}
            </h2>
            <p className="mt-2 font-mono text-sm text-muted">
              День {hud.day} · {hud.population} жителей
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="ghost" onClick={() => cmd('restart')}>
                Новая колония
              </Button>
              <Button onClick={() => ctx.exit()}>На портал</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Roster */}
      <Modal open={rosterOpen} onClose={() => setRosterOpen(false)} title="Жители колонии">
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {hud.colonists.map((c, i) => (
            <div key={i} className="panel-inset flex items-center gap-3 p-2.5">
              <span className="text-sm">{JOB_META[c.job].glyph}</span>
              <span className="w-20 truncate font-display text-sm text-ink">{c.name}</span>
              <span className="flex-1">
                <span className="mb-0.5 block font-mono text-[0.55rem] text-muted">♥ {c.health}</span>
                <ProgressBar value={c.health / 100} tone="good" />
              </span>
              <span className="flex-1">
                <span className="mb-0.5 block font-mono text-[0.55rem] text-muted">☺ {c.morale}</span>
                <ProgressBar value={c.morale / 100} tone="accent" />
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-mono mb-2">{title}</p>
      {children}
    </div>
  );
}
