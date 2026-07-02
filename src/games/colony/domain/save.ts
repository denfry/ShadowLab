// src/games/colony/domain/save.ts
import type { Biome, Building, Colonist, ColonyState, FieldPlot, LogEntry, Resource, ResourceId, ResourceNode, Room } from './types';
import { regenerateWorld } from './worldgen';
import { idx, setBuildingId, setPassable, setBiome, setNode, biomeAt, nodeAt, forEachTile, fertilityAt, setFertility } from '../systems/grid';
import { buildNav } from '../systems/pathHierarchy';
import { CLUSTER } from '../data/balance';

export interface TileOverride { i: number; biome?: Biome; node?: ResourceNode | null; fertility?: number; }

export interface ColonySave {
  version: number;
  seed: number;
  rngState: number;
  tick: number;
  day: number;
  phase: ColonyState['phase'];
  speed: number;
  resources: Record<ResourceId, Resource>;
  colonists: Colonist[];
  buildings: Building[];
  rooms: Room[];
  roomSig: string;
  tailorProgress: number;
  stock: { clothing: number };
  env: ColonyState['env'];
  assignCursor: number;
  designations: number[];
  fields: Array<[number, FieldPlot]>;
  regrowCooldowns: Array<[number, number]>;
  log: LogEntry[];
  flags: { gameOver: boolean; victory: boolean };
  overrides: TileOverride[];
}

/** Разреженные оверрайды: тайлы, чей биом/узел отличается от свежей генерации. */
function diffOverrides(s: ColonyState): TileOverride[] {
  const fresh = regenerateWorld(s.seed);
  const out: TileOverride[] = [];
  forEachTile(s.map, (i, x, y) => {
    const cb = biomeAt(s.map, x, y), gb = biomeAt(fresh, x, y);
    const cn = nodeAt(s.map, x, y), gn = nodeAt(fresh, x, y);
    const cf = fertilityAt(s.map, x, y), gf = fertilityAt(fresh, x, y);
    const biomeChanged = cb !== gb;
    const nodeChanged = (cn?.kind !== gn?.kind) || (cn?.amount !== gn?.amount) || (cn?.max !== gn?.max);
    const fertilityChanged = Math.abs(cf - gf) > 1e-6;
    if (biomeChanged || nodeChanged || fertilityChanged) {
      out.push({
        i,
        ...(biomeChanged ? { biome: cb } : {}),
        ...(nodeChanged ? { node: cn ? { ...cn } : null } : {}),
        ...(fertilityChanged ? { fertility: cf } : {}),
      });
    }
  });
  return out;
}

export function toSave(s: ColonyState): ColonySave {
  return {
    version: s.version,
    seed: s.seed,
    rngState: s.rngState,
    tick: s.tick,
    day: s.day,
    phase: s.phase,
    speed: s.speed,
    resources: s.resources,
    colonists: s.colonists,
    buildings: s.buildings,
    rooms: s.rooms,
    roomSig: s.roomSig,
    tailorProgress: s.tailorProgress,
    stock: s.stock,
    env: s.env,
    assignCursor: s.assignCursor,
    designations: [...s.designations],
    fields: [...s.fields],
    regrowCooldowns: [...s.regrowCooldowns],
    log: s.log,
    flags: s.flags,
    overrides: diffOverrides(s),
  };
}

export function fromSave(p: ColonySave): ColonyState {
  const map = regenerateWorld(p.seed);
  // Накат оверрайдов тайлов.
  for (const o of p.overrides) {
    const x = o.i % map.w, y = Math.floor(o.i / map.w);
    if (o.biome !== undefined) setBiome(map, x, y, o.biome);
    if (o.node !== undefined) setNode(map, x, y, o.node === null ? undefined : { ...o.node });
    if (o.fertility !== undefined) setFertility(map, x, y, o.fertility);
  }
  // Восстановление производного из построек.
  for (const b of p.buildings) {
    if (!b.built) continue;
    setBuildingId(map, b.tile.x, b.tile.y, b.id);
    if (b.type === 'wall') setPassable(map, b.tile.x, b.tile.y, false);
    if (b.type === 'bridge' || b.type === 'tunnel') setPassable(map, b.tile.x, b.tile.y, true);
  }
  const nav = buildNav(map, CLUSTER);
  return {
    version: p.version,
    seed: p.seed,
    rngState: p.rngState,
    tick: p.tick,
    day: p.day,
    phase: p.phase,
    speed: p.speed,
    resources: p.resources,
    colonists: p.colonists,
    buildings: p.buildings,
    rooms: [],          // пересчитает recomputeRooms (roomSig сброшен)
    roomSig: '',
    tailorProgress: p.tailorProgress,
    stock: p.stock,
    env: p.env,
    map,
    nav,
    assignCursor: p.assignCursor ?? 0,
    designations: new Set<number>(p.designations ?? []),
    fields: new Map(p.fields ?? []),
    regrowCooldowns: new Map(p.regrowCooldowns ?? []),
    log: p.log,
    flags: p.flags,
  };
}

// idx экспортируется для тестов/потребителей удобства.
export { idx };
