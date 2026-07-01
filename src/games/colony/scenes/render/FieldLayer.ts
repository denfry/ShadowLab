import Phaser from 'phaser';
import type { ColonyState, FieldPlot } from '../../domain/types';
import { TILE } from '../../data/balance';
import { CROP_GROWTH_TICKS } from '../../data/balance';
import { visibleTileRange } from '../cameraMath';

/** Цвет тайла поля по стадии; 'grow' линейно интерполирует бурый->зелёный по прогрессу. */
export function fieldColor(plot: FieldPlot, growthTicks: number): number {
  if (plot.stage === 'till') return 0x6b4a2f;
  if (plot.stage === 'plant') return 0x7a5a3a;
  if (plot.stage === 'ready') return 0xe8c23a;
  const frac = growthTicks > 0 ? Math.min(1, plot.progress / growthTicks) : 0;
  const from = { r: 0x5a, g: 0x6b, b: 0x2f };
  const to = { r: 0x84, g: 0xde, b: 0x5a };
  const r = Math.round(from.r + (to.r - from.r) * frac);
  const g = Math.round(from.g + (to.g - from.g) * frac);
  const b = Math.round(from.b + (to.b - from.b) * frac);
  return (r << 16) | (g << 8) | b;
}

/** Полупрозрачный оверлей тайлов полей; куллинг по вьюпорту. */
export class FieldLayer {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private state: ColonyState) {
    this.gfx = scene.add.graphics().setDepth(-449); // above DesignationLayer (-450), below sprites
  }

  update(): void {
    this.gfx.clear();
    if (this.state.fields.size === 0) return;
    const cam = this.scene.cameras.main;
    const r = visibleTileRange(
      cam.scrollX, cam.scrollY, cam.zoom, cam.width, cam.height,
      TILE, this.state.map.w, this.state.map.h,
    );
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = y * this.state.map.w + x;
        const plot = this.state.fields.get(i);
        if (!plot) continue;
        this.gfx.fillStyle(fieldColor(plot, CROP_GROWTH_TICKS[plot.crop]), 0.45);
        this.gfx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
