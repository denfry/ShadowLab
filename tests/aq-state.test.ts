import { describe, expect, it } from 'vitest';
import { createGameState, clamp, adjustSuspicion, cloneCrew, topSuspect } from '@/games/among-the-quiet/engine/state';
import { PLAYER_ID } from '@/games/among-the-quiet/engine/types';
import { sampleStation } from './fixtures/sample-station';

describe('createGameState', () => {
  it('initialises day 1, plan phase, living crew, baseline suspicion', () => {
    const s = createGameState(sampleStation, 123);
    expect(s.day).toBe(1);
    expect(s.slot).toBe(0);
    expect(s.phase).toBe('plan');
    expect(s.crew).toHaveLength(4);
    expect(s.crew.every((c) => c.alive)).toBe(true);
    // every crew member holds a baseline suspicion toward the player, not toward self
    const mara = s.crew.find((c) => c.npcId === 'mara')!;
    expect(mara.suspicion[PLAYER_ID]).toBe(sampleStation.startSuspicion);
    expect(mara.suspicion['mara']).toBeUndefined();
    expect(s.player.composure).toBe(100);
    expect(s.objectiveId).toBe('obj_blackbox'); // only one in the pool
  });

  it('is reproducible for a given seed', () => {
    expect(createGameState(sampleStation, 7)).toEqual(createGameState(sampleStation, 7));
  });
});

describe('helpers', () => {
  it('clamp bounds a value', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('adjustSuspicion mutates a CLONE immutably and clamps to [0,100]', () => {
    const s = createGameState(sampleStation, 1);
    const crew = cloneCrew(s.crew);
    adjustSuspicion(crew, 'mara', PLAYER_ID, 30);
    expect(crew.find((c) => c.npcId === 'mara')!.suspicion[PLAYER_ID]).toBe(35);
    expect(s.crew.find((c) => c.npcId === 'mara')!.suspicion[PLAYER_ID]).toBe(5); // original untouched
    adjustSuspicion(crew, 'mara', PLAYER_ID, 999);
    expect(crew.find((c) => c.npcId === 'mara')!.suspicion[PLAYER_ID]).toBe(100);
  });

  it('topSuspect returns the highest non-self suspicion', () => {
    const s = createGameState(sampleStation, 1);
    const crew = cloneCrew(s.crew);
    adjustSuspicion(crew, 'mara', PLAYER_ID, 40);
    const top = topSuspect(crew.find((c) => c.npcId === 'mara')!, 'mara');
    expect(top).toEqual({ subjectId: PLAYER_ID, value: 45 });
  });
});
