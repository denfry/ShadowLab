import type { CaseV2, Condition, Effect, FactRef } from './types';
import type { Rect, MediaSpec } from './media-types';

export interface ValidationIssue {
  code: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

interface Obtainable {
  evidence: Set<string>;
  flags: Set<string>;
  statements: Set<string>;
  contradictions: Set<string>;
  nodes: Set<string>;
}

/** Could this condition EVER be satisfied given the optimistic obtainable set? */
function satisfiable(cond: Condition, o: Obtainable): boolean {
  if ('hasEvidence' in cond) return o.evidence.has(cond.hasEvidence);
  if ('hasFlag' in cond) return o.flags.has(cond.hasFlag);
  if ('foundContradiction' in cond) return o.contradictions.has(cond.foundContradiction);
  if ('accuse' in cond) return true; // the player may always accuse anyone
  if ('all' in cond) return cond.all.every((c) => satisfiable(c, o));
  if ('any' in cond) return cond.any.some((c) => satisfiable(c, o));
  // Optimistic: assume the negated atom is simply never obtained.
  // Known limitation: cannot detect an irreversibly-set flag that makes `not` impossible.
  if ('not' in cond) return true;
  return false;
}

// NOTE: `lockNode` is intentionally NOT modelled. Optimistic reachability asks
// "does SOME playthrough reach this?", so it assumes the favourable path where
// locks never fire. Modelling locks here would risk false positives on solvable cases.
function applyEffectsOptimistic(effects: Effect[] | undefined, o: Obtainable): boolean {
  let changed = false;
  for (const e of effects ?? []) {
    if (e.setFlag && !o.flags.has(e.setFlag)) {
      o.flags.add(e.setFlag);
      changed = true;
    }
    if (e.addNode && !o.nodes.has(e.addNode)) {
      o.nodes.add(e.addNode);
      changed = true;
    }
    if (e.addEvidence && !o.evidence.has(e.addEvidence)) {
      o.evidence.add(e.addEvidence);
      changed = true;
    }
    if (e.addStatement && !o.statements.has(e.addStatement)) {
      o.statements.add(e.addStatement);
      changed = true;
    }
  }
  return changed;
}

function refExists(caseData: CaseV2, ref: FactRef): boolean {
  if (ref.type === 'statement') return caseData.statements.some((s) => s.id === ref.refId);
  if (ref.type === 'metadata') return caseData.evidence.some((e) => e.id === ref.refId && !!e.metadata);
  return caseData.evidence.some((e) => e.id === ref.refId); // 'evidence'
}

const inBounds = (r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 100 && r.y + r.h <= 100;

function validateMedia(evidenceId: string, media: MediaSpec, issues: ValidationIssue[]): void {
  for (const h of media.hotspots) {
    if (!inBounds(h.at)) issues.push({ code: 'hotspot_oob', message: `${evidenceId}: хотспот ${h.id} вне сцены` });
  }
  if (media.frames) {
    for (let i = 1; i < media.frames.length; i += 1) {
      if (media.frames[i].t < media.frames[i - 1].t) {
        issues.push({ code: 'frames_unsorted', message: `${evidenceId}: кадры видео не отсортированы по t` });
        break;
      }
    }
  }
}

function obtainableRef(ref: FactRef, o: Obtainable): boolean {
  if (ref.type === 'statement') return o.statements.has(ref.refId);
  return o.evidence.has(ref.refId); // evidence | metadata both keyed by evidence id
}

/** Collect every suspect id referenced inside an `accuse` condition anywhere in a tree. */
function collectAccuseTargets(cond: Condition, out: Set<string>): void {
  if ('accuse' in cond) out.add(cond.accuse);
  else if ('all' in cond) cond.all.forEach((c) => collectAccuseTargets(c, out));
  else if ('any' in cond) cond.any.forEach((c) => collectAccuseTargets(c, out));
  else if ('not' in cond) collectAccuseTargets(cond.not, out);
}

export function validateCase(caseData: CaseV2): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(caseData.nodes.map((n) => n.id));

  // 1. structural: factrefs resolve
  for (const c of caseData.contradictions) {
    for (const ref of c.between) {
      if (!refExists(caseData, ref)) {
        issues.push({ code: 'bad_factref', message: `Противоречие ${c.id}: ссылка ${ref.type}:${ref.refId} не найдена` });
      }
    }
  }
  // 2. media structural
  for (const e of caseData.evidence) {
    if (e.media) validateMedia(e.id, e.media, issues);
  }
  // 3. start nodes exist
  for (const id of caseData.startNodeIds) {
    if (!nodeIds.has(id)) issues.push({ code: 'bad_start_node', message: `startNode ${id} не найден` });
  }

  // 4. optimistic reachability fixpoint
  const o: Obtainable = {
    evidence: new Set(),
    flags: new Set(),
    statements: new Set(),
    contradictions: new Set(),
    nodes: new Set(caseData.startNodeIds.filter((id) => nodeIds.has(id))),
  };
  let changed = true;
  let guard = 0;
  while (changed && guard < 10_000) {
    guard += 1;
    changed = false;
    for (const node of caseData.nodes) {
      if (!o.nodes.has(node.id)) continue;
      if (node.requires && !satisfiable(node.requires, o)) continue;
      if (applyEffectsOptimistic(node.grants, o)) changed = true;
      for (const ch of node.choices ?? []) {
        if (ch.requires && !satisfiable(ch.requires, o)) continue;
        if (applyEffectsOptimistic(ch.effects, o)) changed = true;
      }
    }
    for (const c of caseData.contradictions) {
      if (o.contradictions.has(c.id)) continue;
      if (c.between.every((ref) => obtainableRef(ref, o))) {
        o.contradictions.add(c.id);
        applyEffectsOptimistic(c.unlocks, o);
        changed = true;
      }
    }
  }
  if (guard >= 10_000) {
    issues.push({ code: 'fixpoint_guard_exceeded', message: 'Достигнут предел итераций анализа достижимости' });
  }

  // 5. coverage
  for (const node of caseData.nodes) {
    if (!o.nodes.has(node.id)) {
      issues.push({ code: 'unreachable_node', message: `Узел ${node.id} недостижим` });
    } else if (node.requires && !satisfiable(node.requires, o)) {
      issues.push({ code: 'node_requires_unsatisfiable', message: `Узел ${node.id} открыт, но его условие входа невыполнимо` });
    }
  }
  for (const c of caseData.contradictions) {
    if (!o.contradictions.has(c.id)) {
      issues.push({ code: 'unreachable_contradiction', message: `Противоречие ${c.id} нераскрываемо` });
    }
  }
  for (const e of caseData.endings) {
    if (!satisfiable(e.requires, o)) issues.push({ code: 'unreachable_ending', message: `Концовка ${e.id} недостижима` });
  }
  if (!caseData.endings.some((e) => e.quality === 'truth' && satisfiable(e.requires, o))) {
    issues.push({ code: 'no_truth_path', message: 'Нет достижимой truth-концовки' });
  }

  // 6. duplicate ids across all keyed collections
  const allIds = [
    ...caseData.nodes.map((n) => n.id),
    ...caseData.evidence.map((e) => e.id),
    ...caseData.statements.map((s) => s.id),
    ...caseData.contradictions.map((c) => c.id),
    ...caseData.endings.map((e) => e.id),
    ...caseData.suspects.map((s) => s.id),
  ];
  const seenIds = new Set<string>();
  for (const id of allIds) {
    if (seenIds.has(id)) issues.push({ code: 'duplicate_id', message: `Дублирующийся id: ${id}` });
    seenIds.add(id);
  }

  // 7. effect targets resolve (setFlag is free-form and intentionally NOT checked —
  //    flags, incl. campaign flags, may be created on the fly)
  const evidenceIds = new Set(caseData.evidence.map((e) => e.id));
  const statementIds = new Set(caseData.statements.map((s) => s.id));
  const effects: Effect[] = [];
  for (const n of caseData.nodes) {
    effects.push(...(n.grants ?? []));
    for (const ch of n.choices ?? []) effects.push(...ch.effects);
  }
  for (const c of caseData.contradictions) effects.push(...(c.unlocks ?? []));
  for (const e of caseData.endings) effects.push(...(e.campaignEffects ?? []));
  for (const e of caseData.evidence) {
    for (const h of e.media?.hotspots ?? []) effects.push(...(h.grants ?? []));
    for (const a of e.media?.artifacts ?? []) effects.push(...(a.grants ?? []));
  }
  for (const e of effects) {
    if (e.addNode && !nodeIds.has(e.addNode)) {
      issues.push({ code: 'bad_effect_target', message: `addNode → неизвестный узел ${e.addNode}` });
    }
    if (e.lockNode && !nodeIds.has(e.lockNode)) {
      issues.push({ code: 'bad_effect_target', message: `lockNode → неизвестный узел ${e.lockNode}` });
    }
    if (e.addEvidence && !evidenceIds.has(e.addEvidence)) {
      issues.push({ code: 'bad_effect_target', message: `addEvidence → неизвестная улика ${e.addEvidence}` });
    }
    if (e.addStatement && !statementIds.has(e.addStatement)) {
      issues.push({ code: 'bad_effect_target', message: `addStatement → неизвестное показание ${e.addStatement}` });
    }
  }

  // 8. suspect refs resolve
  const suspectIds = new Set(caseData.suspects.map((s) => s.id));
  for (const e of caseData.evidence) {
    for (const sid of e.relatedSuspectIds) {
      if (!suspectIds.has(sid)) {
        issues.push({ code: 'bad_suspect_ref', message: `Улика ${e.id}: неизвестный подозреваемый ${sid}` });
      }
    }
  }
  for (const st of caseData.statements) {
    if (!suspectIds.has(st.speakerId)) {
      issues.push({ code: 'bad_suspect_ref', message: `Показание ${st.id}: неизвестный говорящий ${st.speakerId}` });
    }
  }
  const accuseTargets = new Set<string>();
  for (const end of caseData.endings) collectAccuseTargets(end.requires, accuseTargets);
  for (const t of accuseTargets) {
    if (!suspectIds.has(t)) {
      issues.push({ code: 'bad_suspect_ref', message: `Концовка ссылается на неизвестного подозреваемого: ${t}` });
    }
  }

  return { ok: issues.length === 0, issues };
}
