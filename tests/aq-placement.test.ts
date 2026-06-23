import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/utils/rng';
import { weightedPick, placeCrew, playerLocationOf } from '@/games/among-the-quiet/engine/placement';
import { sampleStation } from './fixtures/sample-station';

describe('weightedPick', () => {
  it('returns the only positive-weight option deterministically', () => {
    const rng = new Rng(1);
    // weight 0 option can never be picked; 'b' always wins
    for (let i = 0; i < 20; i += 1) {
      expect(weightedPick([{ locationId: 'a', weight: 0 }, { locationId: 'b', weight: 1 }], rng)).toBe('b');
    }
  });

  it('returns undefined for no options', () => {
    expect(weightedPick([], new Rng(1))).toBeUndefined();
  });
});

describe('placeCrew', () => {
  it('places each crew member in one of their routine locations', () => {
    const place = placeCrew(sampleStation, 0, new Rng(42));
    // slot 0 routines are single-option, so placement is fixed
    expect(place['mara']).toBe('commons');
    expect(place['theo']).toBe('commons');
    expect(place['stein']).toBe('vault');
    expect(place['lina']).toBe('comms');
  });
});

describe('playerLocationOf', () => {
  const place = { mara: 'commons', theo: 'commons', stein: 'vault', lina: 'comms' };
  it('uses the explicit location for blend/observe', () => {
    expect(playerLocationOf({ kind: 'blend', locationId: 'comms' }, sampleStation, place)).toBe('comms');
    expect(playerLocationOf({ kind: 'observe', locationId: 'vault', mode: 'witness' }, sampleStation, place)).toBe('vault');
  });
  it('uses the step location for objective', () => {
    expect(playerLocationOf({ kind: 'objective', stepId: 's_grab' }, sampleStation, place)).toBe('vault');
  });
  it("uses the target npc's placed location for talk", () => {
    expect(playerLocationOf({ kind: 'talk', npcId: 'stein', tack: 'fish' }, sampleStation, place)).toBe('vault');
  });
});
