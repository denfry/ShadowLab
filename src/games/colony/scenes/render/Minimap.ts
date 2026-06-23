import Phaser from 'phaser';
import type { ColonyState } from '../../domain/types';
import { biomeAt, forEachTile } from '../../systems/grid';
import { TILE, MINIMAP_PX, MAP_W, MAP_H } from '../../data/balance';
import { BIOME_BASE } from './textures';
import { worldToMinimap, minimapToWorldTile, minimapViewportRect } from './chunkMath';

const MINIMAP_TEX_KEY = 'col-minimap';
const MARGIN = 8;
const DEPTH_IMG = 9000;
const DEPTH_GFX = 9001;

/**
 * Fixed-position minimap: baked biome image + per-frame dots + viewport rect.
 * Clicking/dragging recenters the camera via the injected `onNavigate` callback.
 *
 * Bake is done once at construction. Per-frame work is dots + viewport only.
 */
export class Minimap {
  private img: Phaser.GameObjects.Image;
  private gfx: Phaser.GameObjects.Graphics;

  /** Screen-space origin of the minimap image (top-left corner). */
  private originX: number;
  private originY: number;

  /** Map pixel dimensions (tile units * TILE px). */
  private readonly mapPxW: number;
  private readonly mapPxH: number;

  private readonly onPointerDown: (p: Phaser.Input.Pointer) => void;
  private readonly onPointerMove: (p: Phaser.Input.Pointer) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: ColonyState,
    private readonly onNavigate: (tileX: number, tileY: number) => void,
  ) {
    this.mapPxW = state.map.w * TILE;
    this.mapPxH = state.map.h * TILE;

    // ---- Bake biome image once ----
    if (scene.textures.exists(MINIMAP_TEX_KEY)) {
      scene.textures.remove(MINIMAP_TEX_KEY);
    }
    const canvas = scene.textures.createCanvas(MINIMAP_TEX_KEY, MINIMAP_PX, MINIMAP_PX);
    if (canvas) {
      const ctx = canvas.getContext();
      const img = ctx.createImageData(MINIMAP_PX, MINIMAP_PX);

      // Compute scale factors once
      const mapW = state.map.w;
      const mapH = state.map.h;

      forEachTile(state.map, (_i, x, y) => {
        const biome = biomeAt(state.map, x, y);
        if (!biome) return;
        const [r, g, b] = BIOME_BASE[biome];

        // Map tile → minimap pixel (integer, floor-scaled)
        const mx = Math.floor((x / mapW) * MINIMAP_PX);
        const my = Math.floor((y / mapH) * MINIMAP_PX);

        // Compute pixel extent for this tile so adjacent tiles don't leave gaps
        const mx2 = Math.floor(((x + 1) / mapW) * MINIMAP_PX);
        const my2 = Math.floor(((y + 1) / mapH) * MINIMAP_PX);

        for (let py = my; py < my2; py++) {
          for (let px = mx; px < mx2; px++) {
            const o = (py * MINIMAP_PX + px) * 4;
            img.data[o]     = r;
            img.data[o + 1] = g;
            img.data[o + 2] = b;
            img.data[o + 3] = 255;
          }
        }
      });

      ctx.putImageData(img, 0, 0);
      canvas.refresh();
    }

    // ---- Place image pinned to camera (top-right corner) ----
    const cam = scene.cameras.main;
    this.originX = cam.width - MINIMAP_PX - MARGIN;
    this.originY = MARGIN;

    this.img = scene.add.image(this.originX, this.originY, MINIMAP_TEX_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_IMG);

    // Draw a border around the minimap
    const borderGfx = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH_IMG);
    borderGfx.lineStyle(1, 0x000000, 0.7);
    borderGfx.strokeRect(this.originX, this.originY, MINIMAP_PX, MINIMAP_PX);
    // We keep border separate but destroy it with the rest in destroy().
    // Store reference so destroy() can clean it up.
    (this as any)._border = borderGfx;

    // ---- Graphics for dots + viewport rect (reused each frame) ----
    this.gfx = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH_GFX);

    // ---- Pointer handlers for click-navigate ----
    this.onPointerDown = (p: Phaser.Input.Pointer) => this.handlePointer(p);
    this.onPointerMove = (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.handlePointer(p);
    };

    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointermove', this.onPointerMove);
  }

  /** Convert screen pointer coords → local minimap coords and call onNavigate if inside. */
  private handlePointer(p: Phaser.Input.Pointer): void {
    const lx = p.x - this.originX;
    const ly = p.y - this.originY;

    // Only handle clicks within the minimap square
    if (lx < 0 || ly < 0 || lx >= MINIMAP_PX || ly >= MINIMAP_PX) return;

    const { x, y } = minimapToWorldTile(
      lx, ly,
      MINIMAP_PX, MINIMAP_PX,
      this.state.map.w, this.state.map.h,
      TILE,
    );
    this.onNavigate(x, y);
  }

  /**
   * Call each frame: redraws colonist/building dots and the viewport rectangle.
   * The baked terrain image is not touched.
   */
  update(): void {
    const g = this.gfx;
    g.clear();

    const mapW = this.state.map.w;
    const mapH = this.state.map.h;
    const ox = this.originX;
    const oy = this.originY;
    const mW = MINIMAP_PX;
    const mH = MINIMAP_PX;
    const mPxW = this.mapPxW;
    const mPxH = this.mapPxH;

    // ---- Buildings (3×3 px squares, white) ----
    g.fillStyle(0xffffff, 0.85);
    for (const b of this.state.buildings) {
      const wx = (b.tile.x + 0.5) / mapW * mPxW;
      const wy = (b.tile.y + 0.5) / mapH * mPxH;
      const { x: mx, y: my } = worldToMinimap(wx, wy, mPxW, mPxH, mW, mH);
      g.fillRect(ox + Math.floor(mx) - 1, oy + Math.floor(my) - 1, 3, 3);
    }

    // ---- Colonists (2×2 px dots, yellow) ----
    g.fillStyle(0xffdd44, 1);
    for (const c of this.state.colonists) {
      if (!c.alive) continue;
      const wx = (c.pos.x + 0.5) / mapW * mPxW;
      const wy = (c.pos.y + 0.5) / mapH * mPxH;
      const { x: mx, y: my } = worldToMinimap(wx, wy, mPxW, mPxH, mW, mH);
      g.fillRect(ox + Math.floor(mx), oy + Math.floor(my), 2, 2);
    }

    // ---- Viewport rectangle ----
    const cam = this.scene.cameras.main;
    const vp = minimapViewportRect(
      cam.scrollX, cam.scrollY, cam.zoom,
      cam.width, cam.height,
      mPxW, mPxH,
      mW, mH,
    );
    g.lineStyle(1, 0xffffff, 0.9);
    g.strokeRect(
      ox + Math.max(0, vp.x),
      oy + Math.max(0, vp.y),
      Math.min(mW - Math.max(0, vp.x), vp.w),
      Math.min(mH - Math.max(0, vp.y), vp.h),
    );
  }

  /** Remove texture, destroy GameObjects, and detach input listeners. */
  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointermove', this.onPointerMove);

    this.img.destroy();
    this.gfx.destroy();
    ((this as any)._border as Phaser.GameObjects.Graphics | undefined)?.destroy();

    if (this.scene.textures.exists(MINIMAP_TEX_KEY)) {
      this.scene.textures.remove(MINIMAP_TEX_KEY);
    }
  }
}
