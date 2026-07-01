import Phaser from 'phaser';
import type { ColonyState, NodeKind } from '../../domain/types';
import { nodeAt } from '../../systems/grid';
import { TILE, LOD_FAR_ZOOM } from '../../data/balance';
import { SPRITE_TEX } from './textures';
import { lodForZoom } from './chunkMath';
import { visibleTileRange } from '../cameraMath';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested, exported)
// ---------------------------------------------------------------------------

/** Depth value for a world-space Y coordinate: higher Y = in front. */
export const entityDepth = (worldY: number): number => worldY;

/** Maps a resource node kind to a sprite group key, or null for non-land sprites. */
export function nodeSpriteKey(kind: NodeKind): 'tree' | 'rock' | 'berry' | null {
  if (kind === 'wood') return 'tree';
  if (kind === 'stone' || kind === 'iron' || kind === 'gold') return 'rock';
  if (kind === 'berries') return 'berry';
  return null; // fish, clay -> no land sprite
}

// ---------------------------------------------------------------------------
// Task colour map (mirrors WorldScene's TASK_COLOR, kept local)
// ---------------------------------------------------------------------------

const TASK_COLOR: Record<string, number> = {
  work: 0x84de5a, goto_work: 0xbfe89a,
  eat: 0xf0a840,  goto_eat: 0xf0c890,
  sleep: 0x6aa0ff, goto_sleep: 0x9ab8ff,
  idle: 0x8aa884,
};

const BUILDING_COLOR: Record<string, number> = {
  bedroom: 0xf0a840, storage: 0xc8b88a, lab: 0x4ad0ff,
  wall: 0x6b6b63, door: 0xa6895b, heater: 0xff6a3d, tailor: 0xb98bd9,
  bridge: 0x9c7a4d, tunnel: 0x5a5550,
};

// ---------------------------------------------------------------------------
// SpriteLayer
// ---------------------------------------------------------------------------

/**
 * Pooled sprite layer for colonists, buildings, and visible resource nodes.
 *
 * Pooling pattern:
 *   - Two Image pools: `spritePool` (entities + nodes) and `shadowPool`.
 *   - One Graphics object (`dotGfx`) for far-LOD dots.
 *   - Each frame: reset cursor to 0, reposition/show needed objects, hide
 *     leftovers. Pools grow on demand; objects are never destroyed mid-session.
 */
export class SpriteLayer {
  // Pooled Image arrays — grown as needed, never shrunk mid-session.
  private spritePool: Phaser.GameObjects.Image[] = [];
  private shadowPool: Phaser.GameObjects.Image[] = [];
  private spriteCursor = 0;
  private shadowCursor = 0;

  // Single Graphics for far-LOD dot rendering.
  private dotGfx: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private state: ColonyState,
  ) {
    // Depth just above terrain chunks (-1000) and water (-900), below HUD.
    this.dotGfx = scene.add.graphics().setDepth(0);
  }

  // -------------------------------------------------------------------------
  // Pool helpers
  // -------------------------------------------------------------------------

  private getSprite(): Phaser.GameObjects.Image {
    if (this.spriteCursor < this.spritePool.length) {
      const img = this.spritePool[this.spriteCursor++];
      img.setVisible(true);
      return img;
    }
    const img = this.scene.add.image(0, 0, SPRITE_TEX.colonist);
    this.spritePool.push(img);
    this.spriteCursor++;
    return img;
  }

  private getShadow(): Phaser.GameObjects.Image {
    if (this.shadowCursor < this.shadowPool.length) {
      const img = this.shadowPool[this.shadowCursor++];
      img.setVisible(true);
      return img;
    }
    const img = this.scene.add.image(0, 0, SPRITE_TEX.shadow);
    this.shadowPool.push(img);
    this.shadowCursor++;
    return img;
  }

  // Hide all pooled objects beyond the current cursor positions.
  private hideUnused(): void {
    for (let i = this.spriteCursor; i < this.spritePool.length; i++) {
      this.spritePool[i].setVisible(false);
    }
    for (let i = this.shadowCursor; i < this.shadowPool.length; i++) {
      this.shadowPool[i].setVisible(false);
    }
  }

  // -------------------------------------------------------------------------
  // Draw helpers: near-LOD sprite + shadow
  // -------------------------------------------------------------------------

  private drawSpriteWithShadow(
    worldX: number, worldY: number,
    texKey: string, tint: number,
    scaleX = 1, scaleY = 1,
  ): void {
    const depth = entityDepth(worldY);

    // Shadow — slightly below entity depth, offset down.
    const shadow = this.getShadow();
    shadow
      .setTexture(SPRITE_TEX.shadow)
      .setPosition(worldX, worldY + TILE * 0.35)
      .setOrigin(0.5, 0.5)
      .setScale(scaleX, scaleY)
      .setDepth(depth - 0.1)
      .setAlpha(0.6)
      .clearTint();

    // Entity sprite.
    const spr = this.getSprite();
    spr
      .setTexture(texKey)
      .setPosition(worldX, worldY)
      .setOrigin(0.5, 0.8)   // anchor at feet for Y-sort alignment
      .setScale(scaleX, scaleY)
      .setDepth(depth)
      .setAlpha(1)
      .setTint(tint);
  }

  // -------------------------------------------------------------------------
  // update() — called every frame by WorldScene
  // -------------------------------------------------------------------------

  update(): void {
    const cam = this.scene.cameras.main;
    const lod = lodForZoom(cam.zoom, LOD_FAR_ZOOM);

    // Reset cursors each frame (pool-reuse pattern).
    this.spriteCursor = 0;
    this.shadowCursor = 0;
    this.dotGfx.clear();

    const map = this.state.map;

    if (lod === 'near') {
      // ------------------------------------------------------------------ //
      //  Near LOD: full sprites + shadows
      // ------------------------------------------------------------------ //

      // 1. Node sprites for visible tile range.
      const r = visibleTileRange(
        cam.scrollX, cam.scrollY, cam.zoom,
        cam.width, cam.height,
        TILE, map.w, map.h,
      );

      for (let ty = r.y0; ty <= r.y1; ty++) {
        for (let tx = r.x0; tx <= r.x1; tx++) {
          const node = nodeAt(map, tx, ty);
          if (!node) continue;
          const key = nodeSpriteKey(node.kind);
          if (!key) continue;

          const texKey = SPRITE_TEX[key];
          const wx = tx * TILE + TILE * 0.5;
          const wy = ty * TILE + TILE * 0.5;
          this.drawSpriteWithShadow(wx, wy, texKey, 0xffffff, 1, 1);
        }
      }

      // 2. Building sprites.
      for (const b of this.state.buildings) {
        const wx = b.tile.x * TILE + TILE * 0.5;
        const wy = b.tile.y * TILE + TILE * 0.5;
        const color = BUILDING_COLOR[b.type] ?? 0xaaaaaa;
        // Use dedicated building marker texture (house glyph), tinted by building color.
        this.drawSpriteWithShadow(wx, wy, SPRITE_TEX.building, color, 1, 1);
      }

      // 3. Colonist sprites.
      for (const c of this.state.colonists) {
        if (!c.alive) continue;
        const wx = c.pos.x * TILE + TILE * 0.5;
        const wy = c.pos.y * TILE + TILE * 0.5;
        const tint = TASK_COLOR[c.task] ?? 0x8aa884;
        this.drawSpriteWithShadow(wx, wy, SPRITE_TEX.colonist, tint, 1, 1);
      }
    } else {
      // ------------------------------------------------------------------ //
      //  Far LOD: simple colored dots via Graphics; no shadows, no nodes.
      // ------------------------------------------------------------------ //
      const dotR = Math.max(2, TILE * cam.zoom * 0.18);

      for (const b of this.state.buildings) {
        const wx = b.tile.x * TILE + TILE * 0.5;
        const wy = b.tile.y * TILE + TILE * 0.5;
        const color = BUILDING_COLOR[b.type] ?? 0xaaaaaa;
        this.dotGfx.fillStyle(color, 0.85);
        this.dotGfx.fillRect(wx - dotR, wy - dotR, dotR * 2, dotR * 2);
      }

      for (const c of this.state.colonists) {
        if (!c.alive) continue;
        const wx = c.pos.x * TILE + TILE * 0.5;
        const wy = c.pos.y * TILE + TILE * 0.5;
        const color = TASK_COLOR[c.task] ?? 0x8aa884;
        this.dotGfx.fillStyle(color, 0.9);
        this.dotGfx.fillCircle(wx, wy, dotR);
      }
    }

    this.hideUnused();
  }

  // -------------------------------------------------------------------------
  // destroy() — clean up all pooled GameObjects
  // -------------------------------------------------------------------------

  destroy(): void {
    for (const img of this.spritePool) img.destroy();
    for (const img of this.shadowPool) img.destroy();
    this.spritePool = [];
    this.shadowPool = [];
    this.dotGfx.destroy();
  }
}
