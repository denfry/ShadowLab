import { describe, expect, it } from 'vitest';
import { runMeeting } from '@/games/among-the-quiet/engine/meeting';
import { createGameState, cloneCrew, adjustSuspicion } from '@/games/among-the-quiet/engine/state';
import { PLAYER_ID } from '@/games/among-the-quiet/engine/types';
import { sampleStation } from './fixtures/sample-station';

// Make the whole crew suspect the player heavily.
function allSuspectPlayer() {
  const s = createGameState(sampleStation, 1);
  const crew = cloneCrew(s.crew);
  for (const c of crew) adjustSuspicion(crew, c.npcId, PLAYER_ID, 80);
  return { ...s, crew, phase: 'meeting' as const };
}

describe('runMeeting', () => {
  it('ejects the player when the crew overwhelmingly suspects them', () => {
    const { ejectedId } = runMeeting(sampleStation, allSuspectPlayer(), { kind: 'quiet' });
    expect(ejectedId).toBe(PLAYER_ID);
  });

  it('a credible alibi deflects the vote away from the player', () => {
    let s = allSuspectPlayer();
    // give the player a real alibi at day1/slot0 with witnesses, and frame stein instead
    s = { ...s, player: { ...s.player, alibis: [{ day: 1, slot: 0, locationId: 'commons', witnessIds: ['mara', 'theo'] }] } };
    const crew = cloneCrew(s.crew);
    for (const c of crew) adjustSuspicion(crew, c.npcId, 'stein', 90); // everyone also suspects stein
    s = { ...s, crew };
    const { ejectedId } = runMeeting(sampleStation, s, { kind: 'alibi', slotRef: { day: 1, slot: 0 } });
    expect(ejectedId).toBe('stein');
  });

  it('sow_doubt stalls the vote — nobody is ejected', () => {
    const { ejectedId } = runMeeting(sampleStation, allSuspectPlayer(), { kind: 'sow_doubt' });
    expect(ejectedId).toBeUndefined();
  });

  it('marks an ejected NPC as not alive and returns to plan phase', () => {
    let s = createGameState(sampleStation, 1);
    const crew = cloneCrew(s.crew);
    for (const c of crew) adjustSuspicion(crew, c.npcId, 'stein', 90);
    s = { ...s, crew, phase: 'meeting' };
    const res = runMeeting(sampleStation, s, { kind: 'quiet' });
    expect(res.ejectedId).toBe('stein');
    expect(res.state.crew.find((c) => c.npcId === 'stein')!.alive).toBe(false);
    expect(res.state.phase).toBe('plan');
  });
});
