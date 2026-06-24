import { describe, expect, it } from 'vitest';
import { resolveSlot } from '@/games/among-the-quiet/engine/resolve';
import { createGameState } from '@/games/among-the-quiet/engine/state';
import { PLAYER_ID } from '@/games/among-the-quiet/engine/types';
import { sampleStation } from './fixtures/sample-station';

const fresh = () => createGameState(sampleStation, 1);
const susp = (s: ReturnType<typeof fresh>, holder: string, subj: string) =>
  s.crew.find((c) => c.npcId === holder)!.suspicion[subj];

describe('resolveSlot — blend', () => {
  it('builds an alibi, lowers co-present suspicion, regenerates composure, advances slot', () => {
    let s = fresh();
    s = { ...s, player: { ...s.player, composure: 50 } };
    // slot 0: mara+theo in commons. Blend in commons => witnesses mara, theo.
    s = resolveSlot(sampleStation, s, { kind: 'blend', locationId: 'commons' });
    expect(susp(s, 'mara', PLAYER_ID)).toBe(0); // 5 - 20 -> clamp 0
    expect(s.player.alibis).toHaveLength(1);
    expect(s.player.alibis[0].witnessIds.sort()).toEqual(['mara', 'theo']);
    expect(s.player.composure).toBe(65); // 50 + 15
    expect(s.slot).toBe(1);
  });
});

describe('resolveSlot — objective', () => {
  it('creates an anomaly; in a public room with a watchful witness it is detected and raises suspicion', () => {
    // Force the risky step to happen in a public room with mara (watchfulness 1):
    // mara is in commons at slot 0. We do the objective at commons by temporarily relocating the step.
    const station = {
      ...sampleStation,
      locations: sampleStation.locations.map((l) => (l.id === 'commons' ? { ...l, objectiveStepIds: ['s_pub'] } : l)),
      objectives: [{ id: 'obj_pub', title: 'X', steps: [{ id: 's_pub', label: 'risk', locationId: 'commons', baseRisk: 1, leavesTrace: { severity: 1, discoverableBy: 'any' as const } }] }],
    };
    let s = createGameState(station, 1, 'obj_pub');
    s = resolveSlot(station, s, { kind: 'objective', stepId: 's_pub' });
    expect(s.anomalies).toHaveLength(1);
    expect(s.anomalies[0].discoveredBy).toBeDefined(); // detected (P=1)
    expect(susp(s, 'mara', PLAYER_ID)).toBeGreaterThan(5);
    expect(s.player.objectiveProgress).toEqual(['s_pub']);
    expect(s.player.composure).toBe(75); // 100 - 25
  });

  it('in a private room with no witness the action is not detected', () => {
    // slot 0: nobody is in vault except stein. Do objective at vault while stein is there -> stein witnesses.
    // Use slot where vault is empty: at slot 2, stein moves to comms, vault empty.
    let s = createGameState(sampleStation, 1);
    s = { ...s, slot: 2 };
    s = resolveSlot(sampleStation, s, { kind: 'objective', stepId: 's_grab' });
    expect(s.anomalies).toHaveLength(1);
    expect(s.anomalies[0].discoveredBy).toBeUndefined(); // no witness in vault at slot 2
  });
});

describe('resolveSlot — talk seed backfire', () => {
  it('seeding to a sharp NPC backfires onto the player; to a soft NPC frames the target', () => {
    let s = fresh();
    // talk to mara (sharp) at slot 0 (mara in commons), seed against stein
    s = resolveSlot(sampleStation, s, { kind: 'talk', npcId: 'mara', tack: 'seed', targetId: 'stein' });
    expect(susp(s, 'mara', PLAYER_ID)).toBeGreaterThan(5); // backfire
    let s2 = fresh();
    // talk to theo (soft) seed against stein -> theo suspects stein more
    s2 = resolveSlot(sampleStation, s2, { kind: 'talk', npcId: 'theo', tack: 'seed', targetId: 'stein' });
    expect(susp(s2, 'theo', 'stein')).toBeGreaterThan(5);
  });
});

describe('resolveSlot — end of day triggers meeting', () => {
  it('after the last slot, phase becomes meeting and day advances', () => {
    let s = fresh();
    s = { ...s, slot: sampleStation.slotsPerDay - 1 };
    s = resolveSlot(sampleStation, s, { kind: 'blend', locationId: 'comms' });
    expect(s.phase).toBe('meeting');
    expect(s.day).toBe(2);
    expect(s.slot).toBe(0);
  });
});
