// src/games/colony/domain/save.ts
import type { Biome, Building, Colonist, ColonyState, LogEntry, Resource, ResourceId, ResourceNode, Room } from './types';
import { regenerateWorld } from './worldgen';
import { idx, setBuildingId, setPassable } from '../systems/grid';

export interface TileOverride { i: number; biome?: Biome; node?: ResourceNode | null; }

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
  log: LogEntry[];
  flags: { gameOver: boolean; victory: boolean };
  overrides: TileOverride[];
}

/** Разреженные оверрайды: тайлы, чей биом/узел отличается от свежей генерации. */
function diffOverrides(s: ColonyState): TileOverride[] {
  const fresh = regenerateWorld(s.seed);
  const out: TileOverride[] = [];
  for (let i = 0; i < s.map.tiles.length; i++) {
    const cur = s.map.tiles[i];
    const gen = fresh.tiles[i];
    const g = gen, cn = cur.node, gn = g.node;
    const biomeChanged = cur.biome !== g.biome;
    const nodeChanged = (cn?.kind !== gn?.kind) || (cn?.amount !== gn?.amount) || (cn?.max !== gn?.max);
    if (biomeChanged || nodeChanged) {
      out.push({
        i,
        ...(biomeChanged ? { biome: cur.biome } : {}),
        ...(nodeChanged ? { node: cn ? { ...cn } : null } : {}),
      });
    }
  }
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
    log: s.log,
    flags: s.flags,
    overrides: diffOverrides(s),
  };
}

export function fromSave(p: ColonySave): ColonyState {
  const map = regenerateWorld(p.seed);
  // Накат оверрайдов тайлов.
  for (const o of p.overrides) {
    const t = map.tiles[o.i];
    if (!t) continue;
    if (o.biome !== undefined) t.biome = o.biome;
    if (o.node !== undefined) t.node = o.node === null ? undefined : { ...o.node };
  }
  // Восстановление производного из построек.
  for (const b of p.buildings) {
    if (!b.built) continue;
    setBuildingId(map, b.tile.x, b.tile.y, b.id);
    if (b.type === 'wall') setPassable(map, b.tile.x, b.tile.y, false);
  }
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
    log: p.log,
    flags: p.flags,
  };
}

// idx экспортируется для тестов/потребителей удобства.
export { idx };
