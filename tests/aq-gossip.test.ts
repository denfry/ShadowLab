import { describe, expect, it } from 'vitest';
import { gossipPhase } from '@/games/among-the-quiet/engine/gossip';
import { createGameState, cloneCrew, adjustSuspicion } from '@/games/among-the-quiet/engine/state';
import { PLAYER_ID } from '@/games/among-the-quiet/engine/types';
import { sampleStation } from './fixtures/sample-station';

// Give mara a strong suspicion of the player, then gossip to her ally theo (bond 60).
function seeded() {
  const s = createGameState(sampleStation, 1);
  const crew = cloneCrew(s.crew);
  adjustSuspicion(crew, 'mara', PLAYER_ID, 60); // mara now 65 on player
  return { ...s, crew };
}

describe('gossipPhase', () => {
  it("propagates a speaker's top suspicion to a positively-bonded listener", () => {
    const before = seeded();
    const theoBefore = before.crew.find((c) => c.npcId === 'theo')!.suspicion[PLAYER_ID];
    const after = gossipPhase(sampleStation, before);
    const theoAfter = after.crew.find((c) => c.npcId === 'theo')!.suspicion[PLAYER_ID];
    expect(theoAfter).toBeGreaterThan(theoBefore); // mara(60 bond) -> theo
  });

  it('does not transfer across a non-positive bond', () => {
    const before = seeded();
    // stein has bond -10 with mara -> no transfer to stein
    const steinBefore = before.crew.find((c) => c.npcId === 'stein')!.suspicion[PLAYER_ID];
    const after = gossipPhase(sampleStation, before);
    const steinAfter = after.crew.find((c) => c.npcId === 'stein')!.suspicion[PLAYER_ID];
    expect(steinAfter).toBe(steinBefore);
  });

  it('does not mutate the input state', () => {
    const before = seeded();
    const snapshot = before.crew.find((c) => c.npcId === 'theo')!.suspicion[PLAYER_ID];
    gossipPhase(sampleStation, before);
    expect(before.crew.find((c) => c.npcId === 'theo')!.suspicion[PLAYER_ID]).toBe(snapshot);
  });
});
