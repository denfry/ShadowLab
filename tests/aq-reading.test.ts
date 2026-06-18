import { describe, expect, it } from 'vitest';
import { bandFor, selfExposure, readCues } from '@/games/among-the-quiet/engine/reading';
import { createGameState, cloneCrew, adjustSuspicion } from '@/games/among-the-quiet/engine/state';
import { PLAYER_ID } from '@/games/among-the-quiet/engine/types';
import { sampleStation } from './fixtures/sample-station';

describe('bandFor', () => {
  it('maps suspicion to bands by threshold', () => {
    expect(bandFor(0)).toBe('trust');
    expect(bandFor(25)).toBe('wary');
    expect(bandFor(50)).toBe('cold');
    expect(bandFor(80)).toBe('accusing');
  });
});

describe('selfExposure', () => {
  it('reflects the highest living suspicion toward the player', () => {
    let s = createGameState(sampleStation, 1);
    expect(selfExposure(s)).toBe('low');
    const crew = cloneCrew(s.crew);
    adjustSuspicion(crew, 'mara', PLAYER_ID, 60); // 65
    s = { ...s, crew };
    expect(selfExposure(s)).toBe('high');
  });
});

describe('readCues', () => {
  it('returns the cue for the NPC band and substitutes {target}', () => {
    let s = createGameState(sampleStation, 1);
    const crew = cloneCrew(s.crew);
    adjustSuspicion(crew, 'mara', PLAYER_ID, 80); // accusing band; mara's top suspect is the player
    s = { ...s, crew };
    const cues = readCues(sampleStation, s, 'mara');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('прямо смотрит на Импостор'); // {target} -> name of top suspect (player)
  });

  it('drops a cue whose traitGate the NPC lacks', () => {
    let s = createGameState(sampleStation, 1);
    const crew = cloneCrew(s.crew);
    // lina is soft_reader, accusing band cue is gated to 'gossip', which lina lacks
    adjustSuspicion(crew, 'lina', PLAYER_ID, 80);
    s = { ...s, crew };
    expect(readCues(sampleStation, s, 'lina')).toEqual([]);
  });

  it('returns [] for an ejected NPC', () => {
    let s = createGameState(sampleStation, 1);
    s = { ...s, crew: s.crew.map((c) => (c.npcId === 'mara' ? { ...c, alive: false } : c)) };
    expect(readCues(sampleStation, s, 'mara')).toEqual([]);
  });
});
