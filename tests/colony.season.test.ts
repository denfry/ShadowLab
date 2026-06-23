import { describe, expect, it } from 'vitest';
import { createColony } from '@/games/colony/domain/createColony';
import { advanceSeason, updateOutdoorTemp } from '@/games/colony/systems/season';
import { SEASON_LENGTH, SEASON_BASE_TEMP } from '@/games/colony/data/balance';
import { Rng } from '@/core/utils/rng';

describe('season system', () => {
  it('advances to the next season after SEASON_LENGTH days', () => {
    const s = createColony(1);
    const rng = new Rng(s.rngState);
    for (let d = 0; d < SEASON_LENGTH; d++) advanceSeason(s, rng);
    expect(s.env.season).toBe('summer');
    expect(s.env.dayInSeason).toBe(0);
  });

  it('outdoor temp tracks the season and drops at night', () => {
    const s = createColony(1);
    s.env.season = 'winter';
    s.env.weather = 'clear';
    s.phase = 'day';
    updateOutdoorTemp(s);
    const dayTemp = s.env.outdoorTemp;
    s.phase = 'night';
    updateOutdoorTemp(s);
    expect(s.env.outdoorTemp).toBeLessThan(dayTemp);
    expect(dayTemp).toBeLessThanOrEqual(SEASON_BASE_TEMP.winter);
  });
});
