import { Rng } from '@/core/utils/rng';
import type { Station, GameState, Speech, CrewMemberState, NPC } from './types';
import { PLAYER_ID } from './types';
import { cloneCrew, adjustSuspicion, isAlive, livingNpcs } from './state';

const LOYALTY_BOND = 50;

/** Apply the player's meeting speech to the room. Returns whether the vote is stalled. */
function applySpeech(station: Station, crew: CrewMemberState[], state: GameState, speech: Speech): boolean {
  const t = station.tuning;
  const voters = livingNpcs(station, crew);
  if (speech.kind === 'alibi') {
    const alibi = state.player.alibis.find((a) => a.day === speech.slotRef.day && a.slot === speech.slotRef.slot);
    if (alibi && alibi.witnessIds.length > 0) {
      for (const v of voters) adjustSuspicion(crew, v.id, PLAYER_ID, -t.suspicionGain * 2);
    } else {
      for (const v of voters) adjustSuspicion(crew, v.id, PLAYER_ID, t.suspicionGain); // caught lying
    }
  } else if (speech.kind === 'accuse') {
    for (const v of voters) adjustSuspicion(crew, v.id, speech.targetId, t.gossipStrength);
  } else if (speech.kind === 'sow_doubt') {
    return true;
  }
  return false;
}

/** The candidate this voter most suspects, skipping strongly-bonded friends (loyalty). */
function voteOf(station: Station, crew: CrewMemberState[], voter: NPC): string | null {
  const vState = crew.find((c) => c.npcId === voter.id)!;
  const candidates = [PLAYER_ID, ...livingNpcs(station, crew).map((n) => n.id).filter((id) => id !== voter.id)];
  let best: { id: string; value: number } | null = null;
  for (const id of candidates) {
    if (id !== PLAYER_ID) {
      const bond = voter.relationships.find((r) => r.npcId === id)?.bond ?? 0;
      if (bond > LOYALTY_BOND) continue; // won't vote a close friend
    }
    const value = vState.suspicion[id] ?? 0;
    if (!best || value > best.value) best = { id, value };
  }
  return best && best.value > 0 ? best.id : null;
}

export function runMeeting(
  station: Station,
  state: GameState,
  speech: Speech,
): { ejectedId?: string; state: GameState } {
  const rng = new Rng(state.rngState);
  const crew = cloneCrew(state.crew);

  const stalled = applySpeech(station, crew, state, speech);

  let ejectedId: string | undefined;
  if (!stalled) {
    const voters = livingNpcs(station, crew);
    const tally: Record<string, number> = {};
    for (const v of voters) {
      const choice = voteOf(station, crew, v);
      if (choice) tally[choice] = (tally[choice] ?? 0) + 1;
    }
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const quorum = Math.ceil(voters.length / 3);
    if (entries.length > 0) {
      const [topId, topVotes] = entries[0];
      const tie = entries.length > 1 && entries[1][1] === topVotes;
      if (!tie && topVotes >= quorum) ejectedId = topId;
    }
  }

  if (ejectedId && ejectedId !== PLAYER_ID) {
    const target = crew.find((c) => c.npcId === ejectedId);
    if (target) target.alive = false;
  }

  return { ejectedId, state: { ...state, crew, phase: 'plan', rngState: rng.seed } };
}
