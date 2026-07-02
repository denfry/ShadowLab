import type { ColonyState, CropId } from '../domain/types';
import type { Rect } from './designations';
import { idx, inBounds, biomeAt, buildingIdAt, nodeAt } from './grid';

export type { Rect };
export type FieldTool = CropId | 'clear';

const FARMABLE_BIOMES = new Set(['grass', 'meadow', 'marsh']);

/** Marks/clears field plots on tiles inside the rect. 'clear' removes any plot;
 *  a crop tool marks eligible bare land (grass/meadow/marsh, no building, no wild
 *  node — chop/mine/forage it first). Re-designating overwrites crop + resets
 *  progress. Fixed iteration order (determinism). */
export function designateField(s: ColonyState, rect: Rect, tool: FieldTool): void {
  const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, y, s.map)) continue;
      const i = idx(x, y, s.map.w);
      if (tool === 'clear') { s.fields.delete(i); continue; }
      const biome = biomeAt(s.map, x, y);
      if (!biome || !FARMABLE_BIOMES.has(biome)) continue;
      if (buildingIdAt(s.map, x, y)) continue;
      if (nodeAt(s.map, x, y)) continue;
      s.fields.set(i, { crop: tool, stage: 'till', progress: 0 });
    }
  }
}
