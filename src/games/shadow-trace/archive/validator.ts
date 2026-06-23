import type { CaseArchive, ArchiveCondition, FactRef } from './types';
import type { Rect } from './media-types';

export interface ValidationIssue {
  code: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

interface Obtainable {
  records: Set<string>; // reachable (sealed or not)
  readable: Set<string>; // reachable AND unsealed
  entities: Set<string>;
  keys: Set<string>;
}

const inBounds = (r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 100 && r.y + r.h <= 100;

function factRefExists(caseData: CaseArchive, ref: FactRef): boolean {
  if (ref.kind === 'entity') return caseData.entities.some((e) => e.id === ref.entityId);
  return caseData.records.some((r) => r.id === ref.recordId);
}

function factRefObtainable(ref: FactRef, o: Obtainable): boolean {
  if (ref.kind === 'entity') return o.entities.has(ref.entityId);
  return o.readable.has(ref.recordId);
}

/** Could this ending condition EVER hold given the optimistic obtainable set? */
function satisfiable(cond: ArchiveCondition, o: Obtainable, caseData: CaseArchive): boolean {
  if ('accuse' in cond) return true; // the player may always accuse anyone
  if ('hasKey' in cond) return o.keys.has(cond.hasKey);
  if ('decisiveLie' in cond || 'noticedContradiction' in cond) {
    const id = 'decisiveLie' in cond ? cond.decisiveLie : cond.noticedContradiction;
    const c = caseData.contradictions.find((x) => x.id === id);
    return Boolean(c) && c!.between.every((ref) => factRefObtainable(ref, o));
  }
  if ('all' in cond) return cond.all.every((c) => satisfiable(c, o, caseData));
  if ('any' in cond) return cond.any.some((c) => satisfiable(c, o, caseData));
  if ('not' in cond) return true; // optimistic: assume the negated atom is simply never obtained
  return false;
}

// Collect only POSITIVE-polarity `accuse` targets — those the player could actually
// assert. We deliberately do NOT descend into `not`: there `accuse x` means the
// opposite, so x must not be required to be a suspect.
function collectAccuseTargets(cond: ArchiveCondition, out: Set<string>): void {
  if ('accuse' in cond) out.add(cond.accuse);
  else if ('all' in cond) cond.all.forEach((c) => collectAccuseTargets(c, out));
  else if ('any' in cond) cond.any.forEach((c) => collectAccuseTargets(c, out));
}

export function validateArchiveCase(caseData: CaseArchive): ValidationResult {
  const issues: ValidationIssue[] = [];
  const recordIds = new Set(caseData.records.map((r) => r.id));
  const entityIds = new Set(caseData.entities.map((e) => e.id));
  const keyIds = new Set(caseData.keysSchema.map((k) => k.id));
  const mediaIds = new Set((caseData.media ?? []).map((m) => m.id));

  // 1. seeds exist
  for (const id of caseData.seedRecordIds) {
    if (!recordIds.has(id)) issues.push({ code: 'bad_seed', message: `seed-запись ${id} не найдена` });
  }

  // 2. per-record references resolve
  for (const r of caseData.records) {
    for (const m of r.mentions) {
      if (!entityIds.has(m)) issues.push({ code: 'bad_mention', message: `Запись ${r.id}: упоминание неизвестной сущности ${m}` });
    }
    if (r.mediaId && !mediaIds.has(r.mediaId)) {
      issues.push({ code: 'bad_media_ref', message: `Запись ${r.id}: неизвестное медиа ${r.mediaId}` });
    }
    if (r.seal && !keyIds.has(r.seal.keyId)) {
      issues.push({ code: 'bad_key_ref', message: `Запись ${r.id}: печать требует неизвестный ключ ${r.seal.keyId}` });
    }
    for (const g of r.grantsKeys ?? []) {
      if (!keyIds.has(g)) issues.push({ code: 'bad_key_ref', message: `Запись ${r.id}: выдаёт неизвестный ключ ${g}` });
    }
    for (const s of r.body) {
      if ('entityId' in s && !entityIds.has(s.entityId)) {
        issues.push({ code: 'bad_span', message: `Запись ${r.id}: спан ссылается на неизвестную сущность ${s.entityId}` });
      }
    }
  }

  // 3. media bounds + hotspot key refs
  for (const asset of caseData.media ?? []) {
    for (const h of asset.media.hotspots) {
      if (!inBounds(h.at)) issues.push({ code: 'hotspot_oob', message: `${asset.id}: хотспот ${h.id} вне сцены` });
      for (const g of h.grantsKeys ?? []) {
        if (!keyIds.has(g)) issues.push({ code: 'bad_key_ref', message: `${asset.id}: хотспот ${h.id} выдаёт неизвестный ключ ${g}` });
      }
    }
  }

  // 4. contradiction factrefs exist
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (!factRefExists(caseData, ref)) {
        issues.push({ code: 'bad_factref', message: `Противоречие ${c.id}: ссылка не разрешается` });
      }
    }
  }

  // 5. reachability fixpoint. Bootstrap discovered entities/keys from the seed
  //    records; the seeds themselves enter o.records/o.readable on the loop's
  //    first pass (seal-aware, exactly like any other record).
  const o: Obtainable = { records: new Set(), readable: new Set(), entities: new Set(), keys: new Set() };
  for (const r of caseData.records) {
    if (!caseData.seedRecordIds.includes(r.id)) continue;
    r.mentions.forEach((m) => o.entities.add(m));
    (r.grantsKeys ?? []).forEach((k) => o.keys.add(k));
  }
  let changed = true;
  let guard = 0;
  while (changed && guard < 10_000) {
    guard += 1;
    changed = false;
    for (const r of caseData.records) {
      const reachable = caseData.seedRecordIds.includes(r.id) || r.mentions.some((m) => o.entities.has(m));
      if (!reachable) continue;
      if (!o.records.has(r.id)) {
        o.records.add(r.id);
        changed = true;
      }
      const unsealed = !r.seal || o.keys.has(r.seal.keyId);
      if (!unsealed) continue;
      if (!o.readable.has(r.id)) {
        o.readable.add(r.id);
        changed = true;
      }
      for (const m of r.mentions) {
        if (!o.entities.has(m)) {
          o.entities.add(m);
          changed = true;
        }
      }
      for (const k of r.grantsKeys ?? []) {
        if (!o.keys.has(k)) {
          o.keys.add(k);
          changed = true;
        }
      }
    }
  }
  if (guard >= 10_000) {
    issues.push({ code: 'fixpoint_guard_exceeded', message: 'Достигнут предел итераций анализа достижимости' });
  }

  // 6. coverage: every record reachable; every sealed record eventually readable
  for (const r of caseData.records) {
    if (!o.records.has(r.id)) {
      issues.push({ code: 'unreachable_record', message: `Запись ${r.id} недостижима` });
    } else if (r.seal && !o.readable.has(r.id)) {
      issues.push({ code: 'unopenable_seal', message: `Запись ${r.id} запечатана, и ключ недобываем` });
    }
  }

  // 7. every declared key obtainable
  for (const k of caseData.keysSchema) {
    if (!o.keys.has(k.id)) issues.push({ code: 'unobtainable_key', message: `Ключ ${k.id} нельзя добыть` });
  }

  // 8. contradiction factrefs reachable (a structurally-missing ref is already
  //    reported by step 4's bad_factref, so skip it here to avoid a duplicate gripe)
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (factRefExists(caseData, ref) && !factRefObtainable(ref, o)) {
        issues.push({ code: 'unreachable_factref', message: `Противоречие ${c.id}: факт недостижим` });
      }
    }
  }

  // 9. endings satisfiable + at least one reachable truth ending
  for (const e of caseData.endings) {
    if (!satisfiable(e.requires, o, caseData)) {
      issues.push({ code: 'unreachable_ending', message: `Концовка ${e.id} недостижима` });
    }
  }
  if (!caseData.endings.some((e) => e.quality === 'truth' && satisfiable(e.requires, o, caseData))) {
    issues.push({ code: 'no_truth_path', message: 'Нет достижимой truth-концовки' });
  }

  // 10. ending `accuse` targets are suspect entities
  const suspectIds = new Set(caseData.entities.filter((e) => e.isSuspect).map((e) => e.id));
  const accuseTargets = new Set<string>();
  for (const e of caseData.endings) collectAccuseTargets(e.requires, accuseTargets);
  for (const t of accuseTargets) {
    if (!suspectIds.has(t)) issues.push({ code: 'bad_suspect_ref', message: `Концовка ссылается на не-подозреваемого ${t}` });
  }

  // 11. duplicate ids across keyed collections
  const allIds = [
    ...caseData.records.map((r) => r.id),
    ...caseData.entities.map((e) => e.id),
    ...caseData.contradictions.map((c) => c.id),
    ...caseData.endings.map((e) => e.id),
    ...caseData.keysSchema.map((k) => k.id),
    ...(caseData.media ?? []).map((m) => m.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) issues.push({ code: 'duplicate_id', message: `Дублирующийся id: ${id}` });
    seen.add(id);
  }

  return { ok: issues.length === 0, issues };
}
