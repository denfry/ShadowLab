import type { ColonyState, NodeKind } from '../domain/types';
import { idx, nodeAt, inBounds } from './grid';

export type DesignationMode = 'chop' | 'mine' | 'forage' | 'cancel';
export interface Rect { x0: number; y0: number; x1: number; y1: number; }

export const MODE_KINDS: Record<'chop' | 'mine' | 'forage', NodeKind[]> = {
  chop: ['wood'],
  mine: ['stone', 'clay', 'iron', 'gold'],
  forage: ['berries'],
};

/** Marks/clears designations on nodes inside the rect. cancel clears any; others
 *  add tiles whose node kind matches the mode. Fixed iteration order (det). */
export function designate(s: ColonyState, rect: Rect, mode: DesignationMode): void {
  const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
  const kinds = mode === 'cancel' ? null : MODE_KINDS[mode];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, y, s.map)) continue;
      const i = idx(x, y, s.map.w);
      if (mode === 'cancel') { s.designations.delete(i); continue; }
      const node = nodeAt(s.map, x, y);
      if (node && kinds!.includes(node.kind)) s.designations.add(i);
    }
  }
}
