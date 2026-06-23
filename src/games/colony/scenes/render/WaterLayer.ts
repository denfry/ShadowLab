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
