import type { ColonyState } from '../domain/types';
import { BASE_SPOIL, SPOIL_COLD_TEMP, TICKS_PER_DAY, WIN_DAY_STUB } from '../data/balance';
import { runNeeds } from './needs';
import { runJobScheduler } from './jobScheduler';
import { stepAgents } from './agent';
import { runWork, advanceGrowth, killUnripeCrops } from './work';
import { advanceSeason, updateOutdoorTemp } from './season';
import { recomputeRooms, wallsDoorsSig } from './rooms';
import { runTemperature } from './temperature';
import { rebuildDirty } from './pathHierarchy';
import { runRegrowth } from './regrowth';
import { Rng } from '@/core/utils/rng';

export const alive = (s: ColonyState) => s.colonists.filter((c) => c.alive);

/** Один тик симуляции. Возвращает true, если начался новый день. */
export function tick(s: ColonyState): boolean {
  if (s.flags.gameOver) return false;
  s.tick += 1;
  s.phase = s.tick % TICKS_PER_DAY < TICKS_PER_DAY / 2 ? 'day' : 'night';
  updateOutdoorTemp(s);

  const sig = wallsDoorsSig(s);
  if (sig !== s.roomSig) { recomputeRooms(s); s.roomSig = sig; }

  runTemperature(s);

  runNeeds(s);
  if (s.nav) rebuildDirty(s.nav, s.map);
  runJobScheduler(s);
  stepAgents(s);
  runWork(s);
  advanceGrowth(s);

  if (s.tick % TICKS_PER_DAY === 0) {
    s.day += 1;
    onNewDay(s);
    return true;
  }
  return false;
}

/** Дневная порча еды: меньше при складах и в холод. */
export function applyFoodSpoilage(s: ColonyState): void {
  const builtStorages = s.buildings.filter((b) => b.type === 'storage' && b.built).length;
  const storageFactor = 1 / (1 + builtStorages * 0.6);
  const tempFactor = s.env.outdoorTemp <= SPOIL_COLD_TEMP ? 0.1 : 1;
  const frac = BASE_SPOIL * storageFactor * tempFactor;
  s.resources.food.amount = Math.max(0, s.resources.food.amount * (1 - frac));
}

function onNewDay(s: ColonyState): void {
  const prevSeason = s.env.season;
  const rng = new Rng(s.rngState);
  advanceSeason(s, rng);
  if (prevSeason !== 'winter' && s.env.season === 'winter') killUnripeCrops(s);
  runRegrowth(s, rng);
  s.rngState = rng.seed;
  applyFoodSpoilage(s);

  if (alive(s).length === 0) {
    s.flags.gameOver = true;
    s.log.push({ day: s.day, text: 'Колония вымерла. Игра окончена.', tone: 'bad' });
  } else if (s.day >= WIN_DAY_STUB) {
    s.flags.gameOver = true;
    s.flags.victory = true;
    s.log.push({ day: s.day, text: `Колония продержалась ${s.day} дней!`, tone: 'good' });
  }
  if (s.log.length > 60) s.log = s.log.slice(-60);
}
