import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameContext } from '@/types/game-module';
import type { ColonyHudState, ResourceId, BuildingType, JobType } from '../domain/types';
import { Button } from '@/ui/primitives/Button';
import { ProgressBar } from '@/ui/primitives/ProgressBar';
import { Modal } from '@/ui/primitives/Modal';
import { cx } from '@/core/utils';
import { IconPause, IconPlay } from '@/ui/icons';
import { BuildMenu } from './panels/BuildMenu';
import { Roster } from './panels/Roster';
import { Inspector } from './panels/Inspector';

const RES_META: Record<ResourceId, { label: string; glyph: string; tone: 'good' | 'warn' | 'accent' }> = {
  food: { label: 'Еда', glyph: '🌾', tone: 'good' },
  wood: { label: 'Дерево', glyph: '🪵', tone: 'warn' },
  science: { label: 'Наука', glyph: '🔬', tone: 'accent' },
  stone: { label: 'Камень', glyph: '🪨', tone: 'warn' },
  clay: { label: 'Глина', glyph: '🧱', tone: 'warn' },
  iron: { label: 'Железо', glyph: '⛓️', tone: 'accent' },
  gold: { label: 'Золото', glyph: '🪙', tone: 'accent' },
  fiber: { label: 'Волокно', glyph: '🧵', tone: 'warn' },
};

const SEASON_LABEL: Record<string, string> = {
  spring: '🌱 Весна',
  summer: '☀️ Лето',
  autumn: '🍂 Осень',
  winter: '❄️ Зима',
};

export function ColonyHud({ ctx }: { ctx: GameContext }) {
  const [hud, setHud] = useState<ColonyHudState | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tempOn, setTempOn] = useState(false);
  const [tool, setTool] = useState<'chop' | 'mine' | 'forage' | 'cancel' | null>(null);
  const [fieldTool, setFieldToolState] = useState<'wheat' | 'potato' | 'legume' | 'flax' | 'clear' | null>(null);

  useEffect(() => {
    const offState = ctx.events.on('game:state', (s: ColonyHudState) => setHud(s));
    const offSel = ctx.events.on('colony:select', (id: string) => setSelectedId(id));
    return () => { offState(); offSel(); };
  }, [ctx]);

  if (!hud) return null;

  const cmd = (type: string, payload?: unknown) => ctx.events.emit('ui:command', { type, payload });
  const selected = hud.colonists.find((c) => c.id === selectedId) ?? null;

  const pickTool = (t: 'chop' | 'mine' | 'forage' | 'cancel') => {
    const next = tool === t ? null : t;
    setTool(next);
    cmd('setTool', { tool: next });
  };

  const pickFieldTool = (t: 'wheat' | 'potato' | 'legume' | 'flax' | 'clear') => {
    const next = fieldTool === t ? null : t;
    setFieldToolState(next);
    cmd('setFieldTool', { tool: next });
  };

  return (
    <>
      {/* Верхний бар ресурсов */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 z-10 px-4 md:px-8">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-2xl border border-edge/60 bg-panel/80 p-3 backdrop-blur">
          {(Object.keys(RES_META) as ResourceId[]).map((id) => {
            const r = hud.resources[id];
            const m = RES_META[id];
            return (
              <div key={id} className="min-w-[120px] flex-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-muted">{m.glyph} {m.label}</span>
                  <span className="text-ink">{Math.floor(r.amount)}/{r.capacity}</span>
                </div>
                <ProgressBar className="mt-1" value={r.amount / r.capacity} tone={m.tone} />
              </div>
            );
          })}
          <div className="flex items-center gap-3 border-l border-edge/50 pl-3 font-mono text-xs text-muted">
            <span>День {hud.day}</span>
            <span>{hud.phase === 'day' ? '🌞' : '🌙'}</span>
            <span>👥 {hud.population}</span>
            <span>{SEASON_LABEL[hud.env.season]} {Math.round(hud.env.outdoorTemp)}°</span>
            <span>🧥 {hud.clothing}</span>
          </div>
        </div>
      </div>

      {/* Правая панель */}
      <div className="absolute bottom-4 right-4 top-32 z-10 hidden w-72 md:block">
        <div className="panel flex h-full flex-col gap-4 overflow-y-auto p-4">
          <div>
            <p className="label-mono mb-2">Зоны добычи</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'chop', label: '🌲 Рубка' },
                { id: 'mine', label: '⛏️ Добыча' },
                { id: 'forage', label: '🫐 Сбор' },
                { id: 'cancel', label: '✕ Отмена' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTool(t.id)}
                  className={cx(
                    'rounded-xl border p-2 text-center font-display text-[0.7rem] transition-all',
                    tool === t.id ? 'border-accent/60 bg-accent/20 text-accent' : 'border-edge/60 text-ink hover:border-accent/50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 font-mono text-[0.55rem] text-muted">выбери режим, затем протяни прямоугольник по карте</p>
          </div>

          <div>
            <p className="label-mono mb-2">Поля</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'wheat', label: '🌾 Пшеница' },
                { id: 'potato', label: '🥔 Картофель' },
                { id: 'legume', label: '🫘 Бобовые' },
                { id: 'flax', label: '🧵 Лён' },
                { id: 'clear', label: '✕ Убрать' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickFieldTool(t.id)}
                  className={cx(
                    'rounded-xl border p-2 text-center font-display text-[0.7rem] transition-all',
                    fieldTool === t.id ? 'border-accent/60 bg-accent/20 text-accent' : 'border-edge/60 text-ink hover:border-accent/50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 font-mono text-[0.55rem] text-muted">выбери культуру, затем протяни прямоугольник по расчищенной земле</p>
          </div>

          <div>
            <p className="label-mono mb-2">Строительство</p>
            <BuildMenu onPick={(b: BuildingType) => cmd('placeBuilding', { building: b })} />
            <p className="mt-1 font-mono text-[0.55rem] text-muted">кликни здание, затем тайл на карте</p>
          </div>

          <div>
            <p className="label-mono mb-2">Жители ({hud.population})</p>
            <button
              className="mb-2 w-full rounded-lg border border-edge/60 py-1.5 font-mono text-[0.65rem] text-muted hover:text-ink"
              onClick={() => setRosterOpen(true)}
            >
              открыть полный список →
            </button>
            {selected ? (
              <Inspector
                colonist={selected}
                onSetPriority={(job: JobType, value: number) =>
                  cmd('setPriority', { colonistId: selected.id, job, value })
                }
              />
            ) : (
              <p className="font-mono text-[0.65rem] text-muted">кликни колониста на карте, чтобы осмотреть</p>
            )}
          </div>

          <div>
            <button
              className="w-full rounded-lg border border-edge/60 py-1.5 font-mono text-[0.65rem] text-muted hover:text-ink"
              onClick={() => { setTempOn((v) => { cmd('toggleTempOverlay', { value: !v }); return !v; }); }}
            >
              оверлей температуры: {tempOn ? 'вкл' : 'выкл'}
            </button>
          </div>

          <div>
            <p className="label-mono mb-2">Журнал</p>
            <div className="space-y-1">
              {hud.log.map((l, i) => (
                <p key={i} className={cx('font-mono text-[0.65rem]', l.tone === 'good' ? 'text-good' : l.tone === 'bad' ? 'text-bad' : 'text-muted')}>
                  д{l.day}: {l.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Скорость */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-2xl border border-edge/60 bg-panel/80 p-1.5 backdrop-blur">
        <button
          className={cx('grid h-9 w-9 place-items-center rounded-xl', hud.speed === 0 ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink')}
          onClick={() => cmd('speed', { value: 0 })}
          aria-label="Пауза"
        >
          <IconPause width={16} height={16} />
        </button>
        {[1, 2, 3].map((sp) => (
          <button
            key={sp}
            className={cx('grid h-9 w-9 place-items-center rounded-xl font-mono text-sm', hud.speed === sp ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink')}
            onClick={() => cmd('speed', { value: sp })}
          >
            {sp === 1 ? <IconPlay width={14} height={14} /> : `${sp}×`}
          </button>
        ))}
      </div>

      {/* Конец игры */}
      {hud.gameOver && (
        <motion.div className="absolute inset-0 z-30 grid place-items-center bg-bg/85 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="panel max-w-sm p-8 text-center">
            <p className="mb-1 font-display text-5xl">{hud.victory ? '🏆' : '💀'}</p>
            <h2 className={cx('font-display text-2xl font-bold', hud.victory ? 'text-good' : 'text-bad')}>
              {hud.victory ? 'Колония выстояла' : 'Колония пала'}
            </h2>
            <p className="mt-2 font-mono text-sm text-muted">День {hud.day} · {hud.population} жителей</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="ghost" onClick={() => cmd('restart')}>Новая колония</Button>
              <Button onClick={() => ctx.exit()}>На портал</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Полный ростер */}
      <Modal open={rosterOpen} onClose={() => setRosterOpen(false)} title="Жители колонии">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <Roster
            colonists={hud.colonists}
            onSelect={(id) => { setSelectedId(id); setRosterOpen(false); }}
          />
        </div>
      </Modal>
    </>
  );
}
