import Phaser from 'phaser';
import type { ColonyState } from '../../domain/types';
import { biomeAt, elevationAt, biomeCodeAt, inBounds } from '../../systems/grid';
import { TILE, CHUNK } from '../../data/balance';
import { chunkIdOf, chunkCounts, chunkTileBounds, visibleChunkRange } from './chunkMath';
import { BIOME_TEX, elevationShade, slopeAO, clampByte } from './textures';

interface LiveChunk { rt: Phaser.GameObjects.RenderTexture; sig: number; }

/** Rehash visible chunks for biome changes once every N frames (felled trees re-tint within ≤N frames). */
const REHASH_INTERVAL = 20;

export class ChunkRenderer {
  private live = new Map<number, LiveChunk>();
  private cw: number;
  private ch: number;
  private frameCount = 0;

  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    const c = chunkCounts(state.map.w, state.map.h, CHUNK);
    this.cw = c.cw;
    this.ch = c.ch;
  }

  /**
   * Cheap biome signature for a chunk — used to detect woodcutting changes
   * (forest→grass). Hashes via biomeCodeAt accessor (seam-safe).
   */
  private chunkSig(cx: number, cy: number): number {
    const { x0, y0, x1, y1 } = chunkTileBounds(cx, cy, CHUNK, this.state.map.w, this.state.map.h);
    let h = 2166136261;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // use biomeCodeAt accessor — no direct SoA reads outside grid.ts
        h ^= biomeCodeAt(this.state.map, x, y);
        h = Math.imul(h, 16777619);
      }
    }
    return h >>> 0;
  }

  /**
   * Bake one chunk's static terrain into a RenderTexture.
   * FIX 2: per-tile tint via a reusable Image — drawFrame has no tint arg,
   * so we stamp a Phaser.GameObjects.Image with setTint(grey) then rt.draw().
   */
  private bake(cx: number, cy: number, sig: number): LiveChunk {
    const { x0, y0, x1, y1 } = chunkTileBounds(cx, cy, CHUNK, this.state.map.w, this.state.map.h);
    const w = (x1 - x0 + 1) * TILE;
    const h = (y1 - y0 + 1) * TILE;

    const rt = this.scene.add
      .renderTexture(x0 * TILE, y0 * TILE, w, h)
      .setOrigin(0, 0)
      .setDepth(-1000);

    // Reusable stamp image — one per bake call, avoids per-tile GameObject allocation.
    // setVisible(false) keeps it off the display list's rendered output.
    const stamp = this.scene.add.image(0, 0, BIOME_TEX('grass')).setVisible(false);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const biome = biomeAt(this.state.map, x, y) ?? 'grass';
        const elev = elevationAt(this.state.map, x, y);

        // Compute min neighbour elevation for slope AO (cliff-edge darkening).
        // Guard OOB: elevationAt returns 0 for out-of-bounds, which would
        // trigger maximum cliff-darkening on map edges. Only include in-bounds neighbours.
        let nmin = elev;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy;
          if (inBounds(nx, ny, this.state.map)) nmin = Math.min(nmin, elevationAt(this.state.map, nx, ny));
        }

        // Elevation-brighter / cliff-darker grey tint: 0..255
        const shade = elevationShade(elev) * slopeAO(elev, nmin);
        const v = clampByte(255 * Math.min(1, shade));
        const tint = Phaser.Display.Color.GetColor(v, v, v);

        // Position stamp at local coords, apply texture + tint, draw into RT.
        const lx = (x - x0) * TILE;
        const ly = (y - y0) * TILE;
        stamp.setTexture(BIOME_TEX(biome)).setTint(tint).setPosition(lx, ly);
        rt.draw(stamp, lx, ly);
      }
    }

    // Clean up the reusable stamp image — it was never part of the scene display.
    stamp.destroy();

    return { rt, sig };
  }

  /**
   * Call each frame:
   *  - Always: cull off-screen chunks + bake newly-visible chunks immediately.
   *  - Every REHASH_INTERVAL frames: re-hash already-live chunks and rebake any
   *    whose biome signature changed (e.g. a felled tree → grass). This keeps
   *    per-frame cost to O(visible-new) rather than O(65k) on every frame.
   */
  update(): void {
    this.frameCount++;
    const doRehash = (this.frameCount % REHASH_INTERVAL) === 0;

    const cam = this.scene.cameras.main;
    const r = visibleChunkRange(
      cam.scrollX, cam.scrollY, cam.zoom,
      cam.width, cam.height,
      TILE, CHUNK,
      this.state.map.w, this.state.map.h,
    );

    const wanted = new Set<number>();
    for (let cy = r.cy0; cy <= r.cy1; cy++) {
      for (let cx = r.cx0; cx <= r.cx1; cx++) {
        const id = chunkIdOf(cx, cy, this.cw);
        wanted.add(id);
        const existing = this.live.get(id);
        if (!existing) {
          // New chunk just became visible — bake immediately every frame.
          const sig = this.chunkSig(cx, cy);
          this.live.set(id, this.bake(cx, cy, sig));
        } else if (doRehash) {
          // Throttled dirty check — only re-hash every REHASH_INTERVAL frames.
          const sig = this.chunkSig(cx, cy);
          if (existing.sig !== sig) {
            existing.rt.destroy();
            this.live.set(id, this.bake(cx, cy, sig));
          }
        }
      }
    }

    // Cull: destroy RTs for chunks that scrolled out of view.
    for (const [id, lc] of this.live) {
      if (!wanted.has(id)) {
        lc.rt.destroy();
        this.live.delete(id);
      }
    }
  }

  /** Destroy all live chunk RenderTextures and clear the pool. */
  destroy(): void {
    for (const lc of this.live.values()) lc.rt.destroy();
    this.live.clear();
  }
}
