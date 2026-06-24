import Phaser from 'phaser';
import type { ColonyState, NodeKind } from '../../domain/types';
import { TILE } from '../../data/balance';
import { nodeAt } from '../../systems/grid';
import { visibleTileRange } from '../cameraMath';

/** Цвет подсветки зоны по виду узла: рубка=зелёный, добыча=оранжевый, сбор=фиолетовый. */
export function designationColor(kind: NodeKind): number {
  if (kind === 'wood') return 0x84de5a;
  if (kind === 'berries') return 0xb46ed8;
  return 0xe8a13a; // stone/clay/iron/gold (+fish, never designated)
}

/** Полупрозрачный оверлей помеченных на добычу тайлов; куллинг по вьюпорту. */
export class DesignationLayer {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    // Above temp overlay (-500), below Y-sorted sprites (0..).
    this.gfx = scene.add.graphics().setDepth(-450);
  }

  update(): void {
    this.gfx.clear();
    if (this.state.designations.size === 0) return;
    const cam = this.scene.cameras.main;
    const r = visibleTileRange(
      cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height,
      TILE, this.state.map.w, this.state.map.h,
    );
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = y * this.state.map.w + x;
        if (!this.state.designations.has(i)) continue;
        const node = nodeAt(this.state.map, x, y);
        if (!node) continue;
        this.gfx.fillStyle(designationColor(node.kind), 0.35);
        this.gfx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
