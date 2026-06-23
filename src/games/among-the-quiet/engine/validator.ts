import type { Station, Objective, Band } from './types';

interface Issue { code: string; message: string }
interface Result { ok: boolean; issues: Issue[] }

const BANDS: Band[] = ['trust', 'wary', 'cold', 'accusing'];

function dagHasCycle(obj: Objective): boolean {
  const byId = new Map(obj.steps.map((s) => [s.id, s]));
  const state = new Map<string, 0 | 1 | 2>(); // 0=unseen 1=in-stack 2=done
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const dep of byId.get(id)?.requires ?? []) {
      if (byId.has(dep) && visit(dep)) return true;
    }
    state.set(id, 2);
    return false;
  };
  return obj.steps.some((s) => visit(s.id));
}

export function validateStation(station: Station): Result {
  const issues: Issue[] = [];
  const locIds = new Set(station.locations.map((l) => l.id));
  const npcIds = new Set(station.crew.map((n) => n.id));

  // duplicate ids
  const dup = (ids: string[], kind: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push({ code: 'duplicate_id', message: `${kind}: дубль id ${id}` });
      seen.add(id);
    }
  };
  dup(station.locations.map((l) => l.id), 'location');
  dup(station.crew.map((n) => n.id), 'crew');
  dup(station.objectives.map((o) => o.id), 'objective');

  // dangling refs
  for (const n of station.crew) {
    for (const slot of Object.values(n.routine)) {
      for (const w of slot) if (!locIds.has(w.locationId)) issues.push({ code: 'bad_ref', message: `${n.id}: рутина → нет локации ${w.locationId}` });
    }
    for (const r of n.relationships) if (!npcIds.has(r.npcId)) issues.push({ code: 'bad_ref', message: `${n.id}: связь → нет NPC ${r.npcId}` });
    if (!station.cueLibrary.some((cs) => cs.readStyle === n.readStyle)) issues.push({ code: 'bad_ref', message: `${n.id}: нет CueSet для readStyle ${n.readStyle}` });
  }
  for (const o of station.objectives) {
    for (const s of o.steps) if (!locIds.has(s.locationId)) issues.push({ code: 'bad_ref', message: `шаг ${s.id} → нет локации ${s.locationId}` });
  }

  // cue coverage for every referenced readStyle
  const usedStyles = new Set(station.crew.map((n) => n.readStyle));
  for (const cs of station.cueLibrary) {
    if (!usedStyles.has(cs.readStyle)) continue;
    for (const b of BANDS) if ((cs.bands[b] ?? []).length === 0) issues.push({ code: 'cue_gap', message: `${cs.readStyle}: нет сигнала в полосе ${b}` });
  }

  // per-objective solvability
  const budget = station.days * station.slotsPerDay - 1;
  const exposureOf = (id: string) => station.locations.find((l) => l.id === id)?.exposure;
  for (const o of station.objectives) {
    if (dagHasCycle(o)) issues.push({ code: 'cyclic_requires', message: `${o.id}: циклические requires` });
    if (o.steps.length > budget) issues.push({ code: 'too_long', message: `${o.id}: шагов больше бюджета (${o.steps.length} > ${budget})` });
    for (const s of o.steps) {
      if (s.baseRisk > 0 && exposureOf(s.locationId) === 'public') {
        issues.push({ code: 'no_safe_window', message: `шаг ${s.id} в public-локации — нет безопасного окна` });
      }
    }
  }

  // bounds
  if (station.days < 2) issues.push({ code: 'bounds', message: 'days < 2' });
  if (station.slotsPerDay < 3) issues.push({ code: 'bounds', message: 'slotsPerDay < 3' });
  if (station.crew.length < 4) issues.push({ code: 'bounds', message: 'crew < 4' });

  return { ok: issues.length === 0, issues };
}
