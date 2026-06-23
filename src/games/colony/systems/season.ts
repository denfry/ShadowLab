import type { ColonyState } from '../domain/types';
import type { Rng } from '@/core/utils/rng';
import {
  NIGHT_TEMP_DROP, SEASON_BASE_TEMP, SEASON_LENGTH, SEASON_ORDER, WEATHER_TEMP_DROP,
} from '../data/balance';

/** Вызывается раз в день из onNewDay. Двигает сезон и катит погоду. */
export function advanceSeason(s: ColonyState, rng: Rng): void {
  s.env.dayInSeason += 1;
  if (s.env.dayInSeason >= SEASON_LENGTH) {
    s.env.dayInSeason = 0;
    const i = SEASON_ORDER.indexOf(s.env.season);
    s.env.season = SEASON_ORDER[(i + 1) % SEASON_ORDER.length];
  }
  s.env.weather = rng.chance(0.15) ? 'cold_snap' : rng.chance(0.3) ? 'snow' : 'clear';
}

/** Пересчёт уличной температуры из сезона/фазы/погоды. Дёшево, каждый тик. */
export function updateOutdoorTemp(s: ColonyState): void {
  let t = SEASON_BASE_TEMP[s.env.season];
  if (s.phase === 'night') t -= NIGHT_TEMP_DROP;
  t -= WEATHER_TEMP_DROP[s.env.weather];
  s.env.outdoorTemp = t;
}
