# Colony FF Foundation · Plan C (Chunked 2.5D Render, Sprites & Minimap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan B's flat per-frame rect renderer with a chunked, baked 2.5D renderer — procedural biome textures + elevation shading + slope AO baked once per visible 32² chunk, animated water as a light overlay, Y-sorted sprites (colonists/buildings/visible resource nodes) with drop-shadows + LOD, and a click-to-navigate minimap.

**Architecture:** `WorldScene` becomes a slim host delegating to focused modules under `scenes/render/`. Static terrain (biome detail textures + elevation shading + cliff/slope ambient occlusion) is baked once per chunk into a Phaser `RenderTexture`; only visible (+1 margin) chunks are live, culled via the Plan-B camera. Animated water is a per-frame overlay on visible water tiles only (never a chunk re-bake). Entities are pooled sprites sorted by world-Y for 2.5D overlap, each with a soft shadow; at far zoom they degrade to dots (LOD). The minimap is a baked downscaled biome texture with live dots and a viewport rectangle. All render logic that can be made pure (chunk/cull/LOD math, texture color model, minimap coordinate transforms, sprite depth/LOD selection, water phase) is extracted and unit-tested; the Phaser draw layer is `tsc`-verified.

**Tech Stack:** TypeScript (strict), Phaser (RenderTexture, Graphics, Containers, Sprites), Vitest (pure-helper tests only), seeded `core/utils/noise.ts` for deterministic textures.

## Global Constraints

- **Render is a pure view — no gameplay changes.** No file under `src/games/colony/domain/**` or `src/games/colony/systems/**` is modified by this plan. No change to `ColonyState`, saves, tick logic, or the 187 existing engine tests' behavior.
- **The accessor seam holds.** Render modules read tiles ONLY through `grid.ts` accessors (`biomeAt`, `elevationAt`, `fertilityAt`, `tempAt`, `passableAt`, `nodeAt`, `forEachTile`). No `.tiles` access anywhere (the Plan-B seam-guard test stays green).
- **Texture determinism:** procedural textures derive from the world seed (`state.seed`) + `core/utils/noise.ts`. Given the same seed the look is reproducible. Render-only animation (water, etc.) MAY use Phaser's frame time — that is view state, never domain state, and never feeds back into `ColonyState`.
- **No headless rendering.** Phaser scenes/RenderTextures need a browser canvas/WebGL context and cannot run in vitest. Therefore: every piece of LOGIC that can be pure IS pure and unit-tested; the Phaser draw layer (texture generation, ChunkRenderer, WaterLayer, SpriteLayer, Minimap, WorldScene wiring) is verified by `npx tsc --noEmit` = 0 errors and does NOT get a headless test. Do not attempt to instantiate a `Phaser.Scene` in a test.
- **Suite stays green + grows:** `npx vitest run` passes (the 187 engine tests are untouched; new tests are the pure render-helper tests) AND `npx tsc --noEmit` = 0 errors, as the gate for every task.
- **Each commit message ends with:**
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

New files:
- `src/games/colony/scenes/render/chunkMath.ts` — pure: chunk indexing, visible-chunk range, LOD selection, minimap coordinate transforms.
- `src/games/colony/scenes/render/textures.ts` — pure color model (`biomePixel`, `elevationShade`, `slopeAO`, `BIOME_BASE`) + Phaser texture generation (`buildBiomeTextures`, `buildSpriteTextures`).
- `src/games/colony/scenes/render/ChunkRenderer.ts` — baked static-terrain chunk RenderTextures with cull/pool/dirty-rebake.
- `src/games/colony/scenes/render/WaterLayer.ts` — animated water overlay (pure `waterScrollOffset` + Phaser overlay).
- `src/games/colony/scenes/render/SpriteLayer.ts` — pooled Y-sort sprites (colonists/buildings/nodes) + shadows + LOD; pure depth/LOD/node-key helpers.
- `src/games/colony/scenes/render/Minimap.ts` — baked minimap + dots + viewport rect + click-to-navigate.
- `tests/colony.chunkMath.test.ts`, `tests/colony.textures.test.ts`, `tests/colony.spriteLayer.test.ts`, `tests/colony.waterLayer.test.ts` — pure-helper unit tests.

Modified files:
- `src/games/colony/data/balance.ts` — render constants (`CHUNK`, `LOD_FAR_ZOOM`, `MINIMAP_PX`, water/texture params).
- `src/games/colony/scenes/WorldScene.ts` — slim host: delegate terrain/water/sprites/minimap to the render modules; keep tick loop, camera (Plan B), input (placement/select/pan/zoom), commands, `onNewDay`, temp overlay.

---

## Task 1: Render constants + `chunkMath.ts` (pure)

Pure math for chunking, culling, LOD, and minimap coordinate transforms. Fully unit-tested.

**Files:**
- Modify: `src/games/colony/data/balance.ts`
- Create: `src/games/colony/scenes/render/chunkMath.ts`
- Create: `tests/colony.chunkMath.test.ts`

**Interfaces (produced — consumed by Tasks 3,4,6,7):**
```ts
export const chunkIdOf: (cx: number, cy: number, chunksW: number) => number;
export const chunkCounts: (w: number, h: number, chunk: number) => { cw: number; ch: number };
export interface ChunkRange { cx0: number; cy0: number; cx1: number; cy1: number; }
export function visibleChunkRange(scrollX:number, scrollY:number, zoom:number, viewW:number, viewH:number, tile:number, chunk:number, mapW:number, mapH:number): ChunkRange;
export function chunkTileBounds(cx:number, cy:number, chunk:number, mapW:number, mapH:number): { x0:number; y0:number; x1:number; y1:number };
export type Lod = 'near' | 'far';
export function lodForZoom(zoom:number, farBelow:number): Lod;
export function worldToMinimap(wx:number, wy:number, mapPxW:number, mapPxH:number, miniW:number, miniH:number): { x:number; y:number };
export function minimapToWorldTile(mx:number, my:number, miniW:number, miniH:number, mapW:number, mapH:number, tile:number): { x:number; y:number };
export function minimapViewportRect(scrollX:number, scrollY:number, zoom:number, viewW:number, viewH:number, mapPxW:number, mapPxH:number, miniW:number, miniH:number): { x:number; y:number; w:number; h:number };
```

- [ ] **Step 1: Add render constants** to `data/balance.ts`:
```ts
// ---- План C: рендер ----
export const CHUNK = 32;            // тайлов на сторону чанка (запекание террейна)
export const LOD_FAR_ZOOM = 0.55;   // zoom < этого -> дальний LOD (точки, без теней)
export const MINIMAP_PX = 192;      // сторона миникарты в экранных пикселях
export const WATER_ANIM_SPEED = 0.012; // скорость прокрутки воды (px/мс при базовом масштабе)
export const TEX_DETAIL = 0.18;     // амплитуда шумовой детали биом-текстур (0..1)
```

- [ ] **Step 2: Write failing tests** `tests/colony.chunkMath.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  chunkIdOf, chunkCounts, visibleChunkRange, chunkTileBounds, lodForZoom,
  worldToMinimap, minimapToWorldTile, minimapViewportRect,
} from '@/games/colony/scenes/render/chunkMath';

describe('chunkMath', () => {
  it('chunkCounts uses ceil so the last partial chunk is included', () => {
    expect(chunkCounts(256, 256, 32)).toEqual({ cw: 8, ch: 8 });
    expect(chunkCounts(40, 40, 32)).toEqual({ cw: 2, ch: 2 });
  });
  it('chunkIdOf is row-major', () => {
    expect(chunkIdOf(0, 0, 8)).toBe(0);
    expect(chunkIdOf(1, 1, 8)).toBe(9);
  });
  it('chunkTileBounds clamps the last chunk to the map', () => {
    expect(chunkTileBounds(0, 0, 32, 256, 256)).toEqual({ x0: 0, y0: 0, x1: 31, y1: 31 });
    expect(chunkTileBounds(7, 7, 32, 250, 250)).toEqual({ x0: 224, y0: 224, x1: 249, y1: 249 });
  });
  it('visibleChunkRange covers on-screen chunks with a +1 margin, clamped', () => {
    // origin (0,0), zoom 1, 100x100px view, tile 22, chunk 32 -> chunk px = 704
    const r = visibleChunkRange(0, 0, 1, 100, 100, 22, 32, 256, 256);
    expect(r.cx0).toBe(0); expect(r.cy0).toBe(0);
    expect(r.cx1).toBeGreaterThanOrEqual(0);
    expect(r.cx1).toBeLessThanOrEqual(1); // ~100px view spans <1 chunk + margin
  });
  it('visibleChunkRange clamps at the far edge', () => {
    const r = visibleChunkRange(255 * 22, 255 * 22, 1, 100, 100, 22, 32, 256, 256);
    expect(r.cx1).toBe(7); expect(r.cy1).toBe(7);
  });
  it('lodForZoom switches at the threshold', () => {
    expect(lodForZoom(0.4, 0.55)).toBe('far');
    expect(lodForZoom(0.55, 0.55)).toBe('near');
    expect(lodForZoom(1.2, 0.55)).toBe('near');
  });
  it('worldToMinimap scales world px into minimap px', () => {
    expect(worldToMinimap(0, 0, 2560, 2560, 192, 192)).toEqual({ x: 0, y: 0 });
    expect(worldToMinimap(2560, 2560, 2560, 2560, 192, 192)).toEqual({ x: 192, y: 192 });
    expect(worldToMinimap(1280, 1280, 2560, 2560, 192, 192)).toEqual({ x: 96, y: 96 });
  });
  it('minimapToWorldTile inverts to a tile coordinate', () => {
    expect(minimapToWorldTile(96, 96, 192, 192, 256, 256, 22)).toEqual({ x: 128, y: 128 });
    expect(minimapToWorldTile(0, 0, 192, 192, 256, 256, 22)).toEqual({ x: 0, y: 0 });
  });
  it('minimapViewportRect maps the camera viewport into minimap space', () => {
    const rect = minimapViewportRect(0, 0, 1, 256, 256, 2560, 2560, 192, 192);
    expect(rect.x).toBe(0); expect(rect.y).toBe(0);
    expect(rect.w).toBeCloseTo(192 * (256 / 2560), 3);
  });
});
```

- [ ] **Step 3: Run, expect failure.** Run: `npx vitest run tests/colony.chunkMath.test.ts`.

- [ ] **Step 4: Implement `chunkMath.ts`:**
```ts
export const chunkIdOf = (cx: number, cy: number, chunksW: number): number => cy * chunksW + cx;

export const chunkCounts = (w: number, h: number, chunk: number): { cw: number; ch: number } => ({
  cw: Math.ceil(w / chunk),
  ch: Math.ceil(h / chunk),
});

export interface ChunkRange { cx0: number; cy0: number; cx1: number; cy1: number; }

export function visibleChunkRange(
  scrollX: number, scrollY: number, zoom: number,
  viewW: number, viewH: number, tile: number, chunk: number, mapW: number, mapH: number,
): ChunkRange {
  const chunkPx = chunk * tile;
  const worldW = viewW / zoom, worldH = viewH / zoom;
  const { cw, ch } = chunkCounts(mapW, mapH, chunk);
  const cx0 = Math.max(0, Math.floor(scrollX / chunkPx) - 1);
  const cy0 = Math.max(0, Math.floor(scrollY / chunkPx) - 1);
  const cx1 = Math.min(cw - 1, Math.floor((scrollX + worldW) / chunkPx) + 1);
  const cy1 = Math.min(ch - 1, Math.floor((scrollY + worldH) / chunkPx) + 1);
  return { cx0, cy0, cx1, cy1 };
}

export function chunkTileBounds(
  cx: number, cy: number, chunk: number, mapW: number, mapH: number,
): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: cx * chunk,
    y0: cy * chunk,
    x1: Math.min(mapW - 1, cx * chunk + chunk - 1),
    y1: Math.min(mapH - 1, cy * chunk + chunk - 1),
  };
}

export type Lod = 'near' | 'far';
export const lodForZoom = (zoom: number, farBelow: number): Lod => (zoom < farBelow ? 'far' : 'near');

export function worldToMinimap(
  wx: number, wy: number, mapPxW: number, mapPxH: number, miniW: number, miniH: number,
): { x: number; y: number } {
  return { x: (wx / mapPxW) * miniW, y: (wy / mapPxH) * miniH };
}

export function minimapToWorldTile(
  mx: number, my: number, miniW: number, miniH: number, mapW: number, mapH: number, _tile: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(mapW - 1, Math.floor((mx / miniW) * mapW))),
    y: Math.max(0, Math.min(mapH - 1, Math.floor((my / miniH) * mapH))),
  };
}

export function minimapViewportRect(
  scrollX: number, scrollY: number, zoom: number, viewW: number, viewH: number,
  mapPxW: number, mapPxH: number, miniW: number, miniH: number,
): { x: number; y: number; w: number; h: number } {
  const worldW = viewW / zoom, worldH = viewH / zoom;
  const tl = worldToMinimap(scrollX, scrollY, mapPxW, mapPxH, miniW, miniH);
  return { x: tl.x, y: tl.y, w: (worldW / mapPxW) * miniW, h: (worldH / mapPxH) * miniH };
}
```

- [ ] **Step 5: Run + tsc.** Run: `npx vitest run tests/colony.chunkMath.test.ts` → green; `npx tsc --noEmit` → 0.

- [ ] **Step 6: Commit.**
```bash
git add src/games/colony/data/balance.ts src/games/colony/scenes/render/chunkMath.ts tests/colony.chunkMath.test.ts
git commit -m "feat(colony): render chunk/LOD/minimap math (pure, tested)"
```

---

## Task 2: `textures.ts` color model (pure)

The deterministic per-pixel color model for terrain: biome base palette, elevation shading, slope ambient occlusion. Unit-tested; consumed by texture generation (Task 3) and ChunkRenderer (Task 4).

**Files:**
- Create: `src/games/colony/scenes/render/textures.ts` (pure part only this task)
- Create: `tests/colony.textures.test.ts`

**Interfaces (produced):**
```ts
export const BIOME_BASE: Record<Biome, [number, number, number]>; // 0..255 rgb
export function elevationShade(elev: number): number;   // multiplier ~0.72..1.18
export function slopeAO(elevHere: number, elevNeighborMin: number): number; // 0.6..1 (1 = flat)
export function clampByte(n: number): number;
export function biomePixel(biome: Biome, elev: number, detail: number, elevNeighborMin: number): [number, number, number];
```

- [ ] **Step 1: Failing tests** `tests/colony.textures.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BIOME_BASE, elevationShade, slopeAO, clampByte, biomePixel } from '@/games/colony/scenes/render/textures';

describe('texture color model', () => {
  it('every biome has an rgb base', () => {
    for (const b of ['water','marsh','meadow','grass','forest','rock','mountain'] as const) {
      expect(BIOME_BASE[b]).toHaveLength(3);
      BIOME_BASE[b].forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); });
    }
  });
  it('elevationShade brightens high ground and darkens low ground monotonically', () => {
    expect(elevationShade(0.9)).toBeGreaterThan(elevationShade(0.5));
    expect(elevationShade(0.5)).toBeGreaterThan(elevationShade(0.1));
  });
  it('slopeAO darkens when the neighbour drops away (cliff) and is 1 on flat', () => {
    expect(slopeAO(0.6, 0.6)).toBe(1);          // flat
    expect(slopeAO(0.6, 0.3)).toBeLessThan(1);  // cliff edge -> darker
    expect(slopeAO(0.6, 0.3)).toBeGreaterThanOrEqual(0.6);
  });
  it('clampByte clamps to 0..255 integers', () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
    expect(clampByte(127.9)).toBe(127);
  });
  it('biomePixel is deterministic and stays in byte range', () => {
    const a = biomePixel('grass', 0.5, 0.2, 0.5);
    const b = biomePixel('grass', 0.5, 0.2, 0.5);
    expect(a).toEqual(b);
    a.forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); });
  });
  it('biomePixel: higher elevation yields a brighter pixel than lower for the same biome', () => {
    const hi = biomePixel('grass', 0.9, 0, 0.9);
    const lo = biomePixel('grass', 0.2, 0, 0.2);
    expect(hi[0] + hi[1] + hi[2]).toBeGreaterThan(lo[0] + lo[1] + lo[2]);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement the pure model** in `textures.ts`:
```ts
import type { Biome } from '../../domain/types';

export const BIOME_BASE: Record<Biome, [number, number, number]> = {
  water:    [29, 66, 86],
  marsh:    [59, 74, 44],
  meadow:   [79, 125, 51],
  grass:    [52, 86, 36],
  forest:   [33, 56, 26],
  rock:     [74, 72, 64],
  mountain: [120, 118, 110],
};

export const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.floor(n)));

/** Множитель яркости от высоты: низины темнее, возвышенности светлее. */
export function elevationShade(elev: number): number {
  // map elev 0..1 -> 0.72..1.18 (linear, gentle)
  return 0.72 + Math.max(0, Math.min(1, elev)) * 0.46;
}

/** Ambient occlusion на склонах: если сосед намного ниже (обрыв) — затемняем кромку. */
export function slopeAO(elevHere: number, elevNeighborMin: number): number {
  const drop = Math.max(0, elevHere - elevNeighborMin);
  // drop 0 -> 1 (flat); drop 0.3+ -> 0.6 (strong cliff darkening)
  return Math.max(0.6, 1 - drop * 1.33);
}

/** Финальный пиксель тайла: база биома × тень высоты × AO + шумовая деталь. */
export function biomePixel(
  biome: Biome, elev: number, detail: number, elevNeighborMin: number,
): [number, number, number] {
  const base = BIOME_BASE[biome];
  const shade = elevationShade(elev) * slopeAO(elev, elevNeighborMin);
  const d = 1 + detail; // detail in ~[-TEX_DETAIL, +TEX_DETAIL]
  return [
    clampByte(base[0] * shade * d),
    clampByte(base[1] * shade * d),
    clampByte(base[2] * shade * d),
  ];
}
```

- [ ] **Step 4: Run + tsc.** `npx vitest run tests/colony.textures.test.ts` → green; `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
```bash
git add src/games/colony/scenes/render/textures.ts tests/colony.textures.test.ts
git commit -m "feat(colony): deterministic terrain color model (biome/elevation/AO, tested)"
```

---

## Task 3: `textures.ts` Phaser generation (biome detail + entity sprites)

Generate, once at scene start, the Phaser textures used by ChunkRenderer and SpriteLayer: a small per-biome tileable detail texture (using the Task-2 model + seeded noise) and the entity sprite textures (tree, rock, berry bush, colonist, building marker). Phaser-only → `tsc`-verified, not headless-tested.

**Files:**
- Modify: `src/games/colony/scenes/render/textures.ts` (append Phaser generation)

**Interfaces (produced — consumed by Tasks 4,6):**
```ts
export const BIOME_TEX = (biome: Biome) => string;        // texture key, e.g. 'col-biome-grass'
export const SPRITE_TEX: { tree:string; rock:string; berry:string; colonist:string; shadow:string };
export function buildBiomeTextures(scene: Phaser.Scene, seed: number, tilePx: number): void;
export function buildSpriteTextures(scene: Phaser.Scene, tilePx: number): void;
```

- [ ] **Step 1: Implement `buildBiomeTextures`.** For each biome, render a `tilePx × tilePx` tileable texture by drawing per-pixel colors from `biomePixel(biome, midElev, detailNoise, midElev)` where `detailNoise` comes from `fbm(seed + biomeIndex, x, y)`. Use a Phaser `CanvasTexture` (`scene.textures.createCanvas`) and `putImageData`, or a `Graphics` per-pixel fill then `generateTexture`. Concretely (CanvasTexture path):
```ts
import Phaser from 'phaser';
import { fbm } from '@/core/utils/noise';
import { TEX_DETAIL } from '../../data/balance';
import type { Biome } from '../../domain/types';

const BIOMES: Biome[] = ['water','marsh','meadow','grass','forest','rock','mountain'];
export const BIOME_TEX = (b: Biome): string => `col-biome-${b}`;

export function buildBiomeTextures(scene: Phaser.Scene, seed: number, tilePx: number): void {
  BIOMES.forEach((biome, bi) => {
    const key = BIOME_TEX(biome);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvas = scene.textures.createCanvas(key, tilePx, tilePx);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const img = ctx.createImageData(tilePx, tilePx);
    for (let y = 0; y < tilePx; y++) {
      for (let x = 0; x < tilePx; x++) {
        const detail = (fbm(seed + bi * 131 + 7, x * 0.6, y * 0.6, 3) * 2 - 1) * TEX_DETAIL;
        const [r, g, b] = biomePixel(biome, 0.5, detail, 0.5);
        const o = (y * tilePx + x) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.refresh();
  });
}
```
(The biome texture stores DETAIL only at mid-elevation; per-tile elevation shading is applied by ChunkRenderer when it stamps the texture, via a tint — see Task 4. This keeps one texture per biome reused across all tiles.)

- [ ] **Step 2: Implement `buildSpriteTextures`.** Generate small procedural sprites with `Phaser.GameObjects.Graphics` + `generateTexture`:
```ts
export const SPRITE_TEX = {
  tree: 'col-spr-tree', rock: 'col-spr-rock', berry: 'col-spr-berry',
  colonist: 'col-spr-colonist', shadow: 'col-spr-shadow',
};
export function buildSpriteTextures(scene: Phaser.Scene, tilePx: number): void {
  const g = scene.add.graphics();
  const mk = (key: string, w: number, h: number, draw: () => void) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    g.clear(); draw(); g.generateTexture(key, w, h);
  };
  const s = tilePx;
  // soft shadow ellipse
  mk(SPRITE_TEX.shadow, s, Math.round(s * 0.5), () => { g.fillStyle(0x000000, 0.28); g.fillEllipse(s / 2, s * 0.25, s * 0.8, s * 0.4); });
  // tree: trunk + canopy
  mk(SPRITE_TEX.tree, s, Math.round(s * 1.4), () => {
    g.fillStyle(0x5a3d22, 1); g.fillRect(s * 0.45, s * 0.9, s * 0.1, s * 0.4);
    g.fillStyle(0x २35, 1); // replaced below
  });
  // NOTE: implement the remaining sprites (rock, berry, colonist) with simple Graphics primitives:
  //  rock: grey rounded polygon; berry: small green bush + red dots; colonist: rounded body + head circle.
  g.destroy();
}
```
**Reviewer-critical:** the `tree` snippet above contains a deliberately-broken placeholder color literal (`0x २35`) to force the implementer to write real drawing code, not copy a stub. Implement all five sprites with valid `Graphics` calls (trunk + green canopy for tree; grey faceted shape for rock; small bush with berry dots for berry; capsule body + head for colonist; soft ellipse for shadow). NO invalid literals may remain — `npx tsc --noEmit` must be 0 and the file must contain no `0x २…`-style tokens.

- [ ] **Step 3: Verify.** `npx tsc --noEmit` → 0; `npx vitest run` (full suite, no new test here — this is Phaser-only) → green. Grep the file to confirm no broken placeholder remains: `grep -n "0x[^0-9a-fA-F]" src/games/colony/scenes/render/textures.ts` returns nothing.

- [ ] **Step 4: Commit.**
```bash
git add src/games/colony/scenes/render/textures.ts
git commit -m "feat(colony): procedural biome + entity sprite texture generation"
```

---

## Task 4: `ChunkRenderer.ts` — baked static-terrain chunks

Bake each visible chunk's static terrain once into a `RenderTexture`: stamp the per-biome detail texture per tile, tinted by per-tile elevation shading + slope AO, plus a thin grid. Cull/pool by `visibleChunkRange`; re-bake a chunk only when its biome signature changes (woodcutting forest→grass). Phaser-only → `tsc` + integration via WorldScene (Task 8).

**Files:**
- Create: `src/games/colony/scenes/render/ChunkRenderer.ts`

**Interfaces (produced — consumed by Task 8):**
```ts
export class ChunkRenderer {
  constructor(scene: Phaser.Scene, state: ColonyState);
  update(): void;     // call each frame: cull to visible, bake new, rebake dirty
  destroy(): void;
}
```

- [ ] **Step 1: Implement.** Full module:
```ts
import Phaser from 'phaser';
import type { ColonyState } from '../../domain/types';
import { biomeAt, elevationAt } from '../../systems/grid';
import { TILE, CHUNK } from '../../data/balance';
import { chunkIdOf, chunkCounts, chunkTileBounds, visibleChunkRange } from './chunkMath';
import { BIOME_TEX } from './textures';
import { elevationShade, slopeAO } from './textures';

interface LiveChunk { rt: Phaser.GameObjects.RenderTexture; sig: number; }

export class ChunkRenderer {
  private live = new Map<number, LiveChunk>();
  private cw: number; private ch: number;
  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    const c = chunkCounts(state.map.w, state.map.h, CHUNK);
    this.cw = c.cw; this.ch = c.ch;
  }

  /** Дешёвая сигнатура биомов чанка для обнаружения изменений (рубка леса). */
  private chunkSig(cx: number, cy: number): number {
    const { x0, y0, x1, y1 } = chunkTileBounds(cx, cy, CHUNK, this.state.map.w, this.state.map.h);
    let h = 2166136261;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      h ^= this.state.map.biome[y * this.state.map.w + x]; // read via SoA array index is INSIDE render; allowed? NO -> use accessor
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private bake(cx: number, cy: number): LiveChunk {
    const { x0, y0, x1, y1 } = chunkTileBounds(cx, cy, CHUNK, this.state.map.w, this.state.map.h);
    const w = (x1 - x0 + 1) * TILE, h = (y1 - y0 + 1) * TILE;
    const rt = this.scene.add.renderTexture(x0 * TILE, y0 * TILE, w, h).setOrigin(0, 0).setDepth(-1000);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const biome = biomeAt(this.state.map, x, y) ?? 'grass';
        const elev = elevationAt(this.state.map, x, y);
        let nmin = elev;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) nmin = Math.min(nmin, elevationAt(this.state.map, x + dx, y + dy));
        const shade = elevationShade(elev) * slopeAO(elev, nmin); // 0..~1.18
        const tint = Phaser.Display.Color.GetColor(
          Math.min(255, Math.round(255 * Math.min(1, shade))),
          Math.min(255, Math.round(255 * Math.min(1, shade))),
          Math.min(255, Math.round(255 * Math.min(1, shade))),
        );
        rt.drawFrame(BIOME_TEX(biome), undefined, (x - x0) * TILE, (y - y0) * TILE, /* tint */ );
        // tint per stamped tile: drawFrame has no tint arg; use an Image stamped with setTint then rt.draw(image)
      }
    }
    return { rt, sig: this.chunkSig(cx, cy) };
  }

  update(): void {
    const cam = this.scene.cameras.main;
    const r = visibleChunkRange(cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height, TILE, CHUNK, this.state.map.w, this.state.map.h);
    const wanted = new Set<number>();
    for (let cy = r.cy0; cy <= r.cy1; cy++) for (let cx = r.cx0; cx <= r.cx1; cx++) {
      const id = chunkIdOf(cx, cy, this.cw); wanted.add(id);
      const existing = this.live.get(id);
      if (!existing) { this.live.set(id, this.bake(cx, cy)); }
      else if (existing.sig !== this.chunkSig(cx, cy)) { existing.rt.destroy(); this.live.set(id, this.bake(cx, cy)); }
    }
    for (const [id, lc] of this.live) if (!wanted.has(id)) { lc.rt.destroy(); this.live.delete(id); }
  }

  destroy(): void { for (const lc of this.live.values()) lc.rt.destroy(); this.live.clear(); }
}
```
**Reviewer-critical / implementer notes (the snippet above is intentionally incomplete in two spots — fix both):**
1. **Seam violation:** `chunkSig` reads `this.state.map.biome[...]` directly — that BREAKS the accessor seam and the seam-guard test (it would match `.biome[`? no — the guard only forbids `.tiles`, but direct SoA array access still violates the seam principle). Use `biomeAt(this.state.map, x, y)` and hash its biome-code via a small `BIOME_INDEX` lookup, OR add a `biomeCodeAt(m,x,y): number` accessor to `grid.ts` (preferred — a cheap typed read through the seam) and use it in `chunkSig`. If you add `biomeCodeAt`, keep it a pure accessor next to `biomeAt`. Do NOT read `state.map.biome` outside `grid.ts`.
2. **Per-tile tint:** `RenderTexture.drawFrame` cannot tint per stamp. Implement the elevation/AO shading by stamping a reusable `Phaser.GameObjects.Image` set to the biome texture with `.setTint(tintRgb)` at the tile position, then `rt.draw(image, ...)` — or precompute the shaded color and stamp a tinted image. Choose the approach that compiles and produces a visibly shaded chunk; the elevation-brighter / cliff-darker effect is the deliverable.

Constraints: only visible chunks live; dirty-rebake on biome-signature change; chunk RTs at depth below sprites; no `.tiles`; no direct `state.map.<array>[...]` outside grid.ts.

- [ ] **Step 2: Verify.** `npx tsc --noEmit` → 0. `npx vitest run` (full suite incl. seam guard) → green — confirm the seam guard still passes (no `.tiles`, and if you added `biomeCodeAt`, it lives in grid.ts). Grep: no `state.map.biome[` / `map.biome[` outside grid.ts.

- [ ] **Step 3: Commit.**
```bash
git add src/games/colony/scenes/render/ChunkRenderer.ts src/games/colony/systems/grid.ts
git commit -m "feat(colony): baked chunk terrain renderer (cull/pool/dirty-rebake)"
```

---

## Task 5: `WaterLayer.ts` — animated water overlay

Animate water cheaply: a per-frame overlay drawn only on visible water tiles, scrolling a translucent ripple tint. Never re-bakes a chunk. Pure `waterScrollOffset` is tested; the Phaser overlay is `tsc`-verified.

**Files:**
- Create: `src/games/colony/scenes/render/WaterLayer.ts`
- Create: `tests/colony.waterLayer.test.ts`

**Interfaces (produced):**
```ts
export function waterScrollOffset(timeMs: number, speed: number, period: number): number; // 0..period
export class WaterLayer { constructor(scene, state); update(timeMs:number):void; destroy():void; }
```

- [ ] **Step 1: Failing test** `tests/colony.waterLayer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { waterScrollOffset } from '@/games/colony/scenes/render/WaterLayer';
describe('waterScrollOffset', () => {
  it('is deterministic and wraps within the period', () => {
    expect(waterScrollOffset(0, 0.01, 16)).toBe(0);
    expect(waterScrollOffset(1000, 0.01, 16)).toBeCloseTo(10 % 16, 5);
    const o = waterScrollOffset(999999, 0.01, 16);
    expect(o).toBeGreaterThanOrEqual(0); expect(o).toBeLessThan(16);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement.** `WaterLayer.ts`:
```ts
import Phaser from 'phaser';
import type { ColonyState } from '../../domain/types';
import { biomeAt } from '../../systems/grid';
import { TILE, WATER_ANIM_SPEED } from '../../data/balance';
import { visibleTileRange } from '../cameraMath';

export function waterScrollOffset(timeMs: number, speed: number, period: number): number {
  const raw = timeMs * speed;
  return ((raw % period) + period) % period;
}

export class WaterLayer {
  private g: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    this.g = scene.add.graphics().setDepth(-900); // above terrain, below sprites
  }
  update(timeMs: number): void {
    const cam = this.scene.cameras.main;
    const r = visibleTileRange(cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height, TILE, this.state.map.w, this.state.map.h);
    const off = waterScrollOffset(timeMs, WATER_ANIM_SPEED, TILE);
    this.g.clear();
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (biomeAt(this.state.map, x, y) !== 'water') continue;
      // two scrolling translucent bands give a ripple shimmer
      const a = 0.10 + 0.05 * Math.sin((x + y) * 0.7 + off * 0.4);
      this.g.fillStyle(0x7fb6d6, Math.max(0, a));
      this.g.fillRect(x * TILE + ((off) % TILE) - TILE, y * TILE + (TILE * 0.35), TILE, 2);
      this.g.fillRect(x * TILE, y * TILE + (TILE * 0.7) - (off % TILE), TILE, 2);
    }
  }
  destroy(): void { this.g.destroy(); }
}
```

- [ ] **Step 4: Run + tsc.** `npx vitest run tests/colony.waterLayer.test.ts` → green; full suite green; `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
```bash
git add src/games/colony/scenes/render/WaterLayer.ts tests/colony.waterLayer.test.ts
git commit -m "feat(colony): animated water overlay on visible water tiles"
```

---

## Task 6: `SpriteLayer.ts` — Y-sort sprites + shadows + LOD + nodes

Pooled sprites for colonists, buildings, and visible resource nodes (trees in forest, rock/ore outcrops, berry bushes), each with a soft shadow, depth-sorted by world-Y for 2.5D overlap. At far zoom (LOD), degrade to simple dots without shadows. Pure depth/LOD/node-key helpers are tested; the Phaser pooling/draw is `tsc`-verified.

**Files:**
- Create: `src/games/colony/scenes/render/SpriteLayer.ts`
- Create: `tests/colony.spriteLayer.test.ts`

**Interfaces (produced — consumed by Task 8):**
```ts
export const entityDepth: (worldY: number) => number;
export function nodeSpriteKey(kind: NodeKind): keyof typeof SPRITE_TEX | null; // wood->'tree', stone/iron/gold->'rock', berries->'berry', else null
export class SpriteLayer { constructor(scene, state); update():void; destroy():void; }
```

- [ ] **Step 1: Failing test** `tests/colony.spriteLayer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { entityDepth, nodeSpriteKey } from '@/games/colony/scenes/render/SpriteLayer';
describe('SpriteLayer helpers', () => {
  it('entityDepth increases with world-y (lower on screen = front)', () => {
    expect(entityDepth(100)).toBeGreaterThan(entityDepth(50));
  });
  it('nodeSpriteKey maps node kinds to sprite groups', () => {
    expect(nodeSpriteKey('wood')).toBe('tree');
    expect(nodeSpriteKey('stone')).toBe('rock');
    expect(nodeSpriteKey('iron')).toBe('rock');
    expect(nodeSpriteKey('gold')).toBe('rock');
    expect(nodeSpriteKey('berries')).toBe('berry');
    expect(nodeSpriteKey('fish')).toBeNull(); // fish not drawn as a land sprite
    expect(nodeSpriteKey('clay')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement.** `SpriteLayer.ts` — pure helpers + a pooled container. Provide the pure helpers exactly:
```ts
import Phaser from 'phaser';
import type { ColonyState, NodeKind } from '../../domain/types';
import { forEachTile, nodeAt } from '../../systems/grid';
import { TILE, LOD_FAR_ZOOM } from '../../data/balance';
import { SPRITE_TEX } from './textures';
import { lodForZoom } from './chunkMath';
import { visibleTileRange } from '../cameraMath';

export const entityDepth = (worldY: number): number => worldY;

export function nodeSpriteKey(kind: NodeKind): 'tree' | 'rock' | 'berry' | null {
  if (kind === 'wood') return 'tree';
  if (kind === 'stone' || kind === 'iron' || kind === 'gold') return 'rock';
  if (kind === 'berries') return 'berry';
  return null; // fish, clay -> no land sprite
}
```
Then a `SpriteLayer` class that, each `update()`:
- computes `lod = lodForZoom(cam.zoom, LOD_FAR_ZOOM)`;
- culls to `visibleTileRange`;
- **near LOD:** draws node sprites (visible tiles with a `nodeSpriteKey`), building sprites, and colonist sprites — each as a pooled `Image` with a shadow `Image` beneath, `setDepth(entityDepth(worldY))` (shadow depth `= worldY - 0.1`); colonist tint by task; building marker by type;
- **far LOD:** a single pooled `Graphics`/dots layer (no shadows, no node sprites) — colonists/buildings as small colored squares/dots;
- pools/reuses GameObjects across frames (don't recreate every frame — keep arrays and `setVisible`/reposition; grow the pool as needed).
Use the brief's pure helpers verbatim; implement the pooling with simple reusable arrays (`pool: Image[]`, an index cursor reset each frame, hide leftovers). Keep colonist selection visuals (e.g. a ring on the selected id) optional/out of scope — selection still works via WorldScene input.

Constraints: read tiles/nodes via accessors only; depth = world-y (in px) so lower-on-screen draws in front; shadows are separate offset images; LOD switch at `LOD_FAR_ZOOM`; pool objects (no per-frame allocation storms).

- [ ] **Step 4: Run + tsc.** `npx vitest run tests/colony.spriteLayer.test.ts` → green; full suite green; `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit.**
```bash
git add src/games/colony/scenes/render/SpriteLayer.ts tests/colony.spriteLayer.test.ts
git commit -m "feat(colony): Y-sort sprite layer (colonists/buildings/nodes) + shadows + LOD"
```

---

## Task 7: `Minimap.ts` — baked minimap + dots + viewport + click-navigate

A fixed-position minimap: a once-baked downscaled biome image, live colonist/building dots, and a viewport rectangle; clicking/dragging on it recenters the camera. Uses the Task-1 minimap math (already tested). Phaser-only → `tsc`.

**Files:**
- Create: `src/games/colony/scenes/render/Minimap.ts`

**Interfaces (produced — consumed by Task 8):**
```ts
export class Minimap {
  constructor(scene: Phaser.Scene, state: ColonyState, onNavigate: (tileX:number, tileY:number) => void);
  update(): void;   // refresh dots + viewport rect
  destroy(): void;
}
```

- [ ] **Step 1: Implement.** Bake the biome image once (iterate `forEachTile`, plot one minimap pixel per tile via `worldToMinimap`/scale using `BIOME_BASE` colors into a CanvasTexture sized `MINIMAP_PX`), pin it to the camera (`setScrollFactor(0)`) in a corner; each `update()` redraw a small Graphics with colonist/building dots (via `worldToMinimap`) and the `minimapViewportRect`; on pointerdown/drag within the minimap bounds, convert via `minimapToWorldTile` and call `onNavigate(tileX, tileY)`. Keep it self-contained; WorldScene supplies `onNavigate` that sets camera scroll centered on that tile (clamped via `clampScroll`).

Constraints: bake once (biomes don't change at minimap resolution meaningfully — node-driven forest→grass is invisible at 1px/tile, acceptable; do NOT re-bake per frame); dots + viewport are the only per-frame work; `setScrollFactor(0)` so it stays fixed; read via accessors + `BIOME_BASE`.

- [ ] **Step 2: Verify.** `npx tsc --noEmit` → 0; full suite green (no new test; minimap math already covered in Task 1).

- [ ] **Step 3: Commit.**
```bash
git add src/games/colony/scenes/render/Minimap.ts
git commit -m "feat(colony): minimap (baked biomes + dots + viewport + click-navigate)"
```

---

## Task 8: `WorldScene.ts` rewire to slim host

Replace the Plan-B per-frame rect renderer with the new modules: build textures at `create()`, own `ChunkRenderer`/`WaterLayer`/`SpriteLayer`/`Minimap`, drive them from `update()`. Preserve ALL non-render logic: the fixed-step tick loop, camera pan/zoom (Plan B), building placement + colonist selection input, command handling, `onNewDay` (achievements/records/autosave/toasts), temp overlay toggle, and `restart`.

**Files:**
- Modify: `src/games/colony/scenes/WorldScene.ts`

- [ ] **Step 1: Rewire `create()`.** After camera setup: `buildBiomeTextures(this, this.state.seed, TILE); buildSpriteTextures(this, TILE);` then instantiate `this.chunks = new ChunkRenderer(this, this.state); this.water = new WaterLayer(this, this.state); this.sprites = new SpriteLayer(this, this.state); this.minimap = new Minimap(this, this.state, (tx, ty) => this.centerOnTile(tx, ty));`. Remove the old `mapLayer`/`drawMap`/`redrawMap`, `buildingLayer`/`syncBuildings`, `dotLayer`/`spawnDots`/`dots`. Keep `tempLayer`/`drawTempOverlay` (culled, as in Plan B) layered above terrain/water, below or above sprites as preferred — keep the toggle working.

- [ ] **Step 2: Rewire `update()`.** Keep the tick loop + WASD/arrow pan + zoom + `clampScroll` + `cam.setScroll/Zoom` (Plan B). Replace the render block with:
```ts
this.chunks.update();
this.water.update(this.time.now);
this.sprites.update();
this.minimap.update();
if (this.tempOverlay) this.drawTempOverlay(); else this.tempLayer.clear();
```
Keep the throttled `game:state` HUD emit.

- [ ] **Step 3: Preserve input + commands + lifecycle.** `onPointerDown/Move/Up` (placement, drag-pan, <4px = colonist select), `onCommand` (speed/place/cancel/setPriority/toggleTempOverlay/restart), `onNewDay`, `shutdown()`. Add `centerOnTile(tx,ty)` that sets `camScrollX/Y` to center the tile and clamps. In `shutdown()` and on `restart`, call `this.chunks.destroy(); this.water.destroy(); this.sprites.destroy(); this.minimap.destroy();` to free RTs/textures. On `restart`, rebuild textures for the new seed.

- [ ] **Step 4: Verify.** `npx tsc --noEmit` → 0. `npx vitest run` (FULL suite) → green (engine tests untouched; render-helper tests pass). Confirm the seam guard passes (`grep -rn "\.tiles" src/games/colony` outside grid.ts → none; no `state.map.<array>[` outside grid.ts).

- [ ] **Step 5: Update `definition.ts` copy** if warranted (mention the new visuals) — optional, strings only.

- [ ] **Step 6: Commit.**
```bash
git add src/games/colony/scenes/WorldScene.ts src/games/colony/definition.ts
git commit -m "feat(colony): WorldScene slim host delegating to chunked 2.5D render modules"
```

---

## Self-Review (completed during planning)

- **Spec coverage (§5):** ChunkRenderer (T4), SpriteLayer + Y-sort + shadows + LOD (T6), Minimap (T7), CameraController (Plan B — reused), overlays/temp (T8). Procedural textures (T2/T3). Animated water — the user's max-detail choice — added as a cheap overlay (T5) rather than chunk re-bake. Slope AO / cliff darkening (T2/T4). All of the user's three visual choices are covered.
- **Verification honesty:** pure helpers (chunkMath, texture color model, water phase, sprite depth/LOD/node-key, minimap math) are unit-tested; the irreducibly-Phaser layer (texture gen, ChunkRenderer, WaterLayer overlay, SpriteLayer pooling, Minimap, WorldScene) is `tsc`-only — stated explicitly in Global Constraints and per task. No task pretends to headlessly test a `Phaser.Scene`.
- **Seam discipline:** every render module reads via accessors; Task 4 explicitly forbids `state.map.biome[...]` and routes the chunk signature through `biomeAt`/a new `biomeCodeAt` accessor. The Plan-B seam guard stays the gate.
- **Placeholder scan:** the ONLY intentional placeholders are the explicitly-flagged broken `tree` color literal (T3 Step 2) and the two flagged incomplete spots in `ChunkRenderer` (T4 Step 1) — each with a "fix this, no stub may remain" instruction + a grep check.
- **Type consistency:** `BIOME_TEX`/`SPRITE_TEX`/`biomePixel`/`entityDepth`/`nodeSpriteKey`/`visibleChunkRange`/minimap transforms are defined once and consumed with the same signatures downstream.

---

## Execution Handoff

Plan complete and saved. Recommended execution: **subagent-driven-development** (fresh implementer per task on `sonnet`, task review after each, final whole-branch review), continuing in this worktree (`feat/colony-ff-plan-c-render`, stacked on Plan B's `feat/colony-ff-plan-b-scale`). Note for reviewers: render tasks are `tsc`-gated, not headless-tested — review code quality + seam discipline + the pure-helper tests, not runtime visuals.
