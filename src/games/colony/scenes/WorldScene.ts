import Phaser from 'phaser';
import type { GameContext } from '@/types/game-module';
import type { BuildingType, ColonyState, Colonist } from '../domain/types';
import { TILE } from '../data/balance';
import { tick, alive } from '../systems/tick';
import { computeHud } from '../systems/projection';
import { placeBlueprint, canPlace } from '../systems/build';
import { tempAt } from '../systems/grid';
import { createColony } from '../domain/createColony';
import { toSave } from '../domain/save';
import { randomSeed } from '@/core/utils/rng';
import { visibleTileRange, clampScroll } from './cameraMath';
import { buildBiomeTextures, buildSpriteTextures } from './render/textures';
import { ChunkRenderer } from './render/ChunkRenderer';
import { WaterLayer } from './render/WaterLayer';
import { SpriteLayer } from './render/SpriteLayer';
import { Minimap } from './render/Minimap';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;
const PAN_SPEED = 8; // world-px per frame at zoom=1

export class WorldScene extends Phaser.Scene {
  private state!: ColonyState;
  private ctx!: GameContext;
  private accumulator = 0;
  private emitAccum = 0;
  private readonly tickMs = 1000 / 8;
  private mapPxW = 0;
  private mapPxH = 0;
  private tempLayer!: Phaser.GameObjects.Graphics;
  private tempOverlay = false;
  private placingType: BuildingType | null = null;
  private ghost!: Phaser.GameObjects.Rectangle;

  // Render modules (Plan C)
  private chunks!: ChunkRenderer;
  private water!: WaterLayer;
  private sprites!: SpriteLayer;
  private minimap!: Minimap;

  // Camera pan/zoom state
  private camScrollX = 0;
  private camScrollY = 0;
  private camZoom = 1;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragScrollStartX = 0;
  private dragScrollStartY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor() { super('world'); }

  init(data: { state: ColonyState; ctx: GameContext }) {
    this.state = data.state;
    this.ctx = data.ctx;
  }

  create() {
    this.mapPxW = this.state.map.w * TILE;
    this.mapPxH = this.state.map.h * TILE;
    this.cameras.main.setBackgroundColor('#0d140c');

    // Keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Pointer drag for panning
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    // Wheel zoom
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.9 : 1.1;
      this.camZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camZoom * factor));
    });

    // Initial framing: center on first colonist or map center, zoom to fit
    const startX = this.state.colonists[0]?.pos.x ?? this.state.map.w / 2;
    const startY = this.state.colonists[0]?.pos.y ?? this.state.map.h / 2;
    const cam = this.cameras.main;
    // Choose a comfortable initial zoom (show ~30 tiles across)
    this.camZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.width / (30 * TILE)));
    // Center scroll on start position
    this.camScrollX = startX * TILE - (cam.width / this.camZoom) / 2;
    this.camScrollY = startY * TILE - (cam.height / this.camZoom) / 2;
    const clamped = clampScroll(this.camScrollX, this.camScrollY, this.camZoom,
      cam.width, cam.height, this.mapPxW, this.mapPxH);
    this.camScrollX = clamped.x;
    this.camScrollY = clamped.y;

    cam.setZoom(this.camZoom);
    cam.setScroll(this.camScrollX, this.camScrollY);

    this.scale.on('resize', this.onResize, this);
    this.ctx.events.on('ui:command', this.onCommand);

    // Build textures for the new seed, then instantiate render modules
    buildBiomeTextures(this, this.state.seed, TILE);
    buildSpriteTextures(this, TILE);

    this.chunks = new ChunkRenderer(this, this.state);
    this.water = new WaterLayer(this, this.state);
    this.sprites = new SpriteLayer(this, this.state);
    this.minimap = new Minimap(this, this.state, (tx, ty) => this.centerOnTile(tx, ty));

    // Temp overlay layer — drawn above terrain/water, below/above sprites as needed
    this.tempLayer = this.add.graphics();

    this.ghost = this.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0.25).setVisible(false);
    this.ghost.setStrokeStyle(1, 0xffffff, 0.6);

    this.ctx.events.emit('game:state', computeHud(this.state));
  }

  /** Center the camera scroll on tile (tx, ty) and clamp to world bounds. */
  private centerOnTile(tx: number, ty: number): void {
    const cam = this.cameras.main;
    this.camScrollX = (tx + 0.5) * TILE - (cam.width / this.camZoom) / 2;
    this.camScrollY = (ty + 0.5) * TILE - (cam.height / this.camZoom) / 2;
    const clamped = clampScroll(this.camScrollX, this.camScrollY, this.camZoom,
      cam.width, cam.height, this.mapPxW, this.mapPxH);
    this.camScrollX = clamped.x;
    this.camScrollY = clamped.y;
    cam.setScroll(this.camScrollX, this.camScrollY);
  }

  private drawTempOverlay() {
    this.tempLayer.clear();
    if (!this.tempOverlay) return;
    const cam = this.cameras.main;
    const r = visibleTileRange(
      cam.scrollX, cam.scrollY, cam.zoom,
      cam.width, cam.height,
      TILE, this.state.map.w, this.state.map.h,
    );
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        // синий (холод) → красный (тепло), диапазон -20..30
        const k = Math.max(0, Math.min(1, (tempAt(this.state.map, x, y) + 20) / 50));
        const r_ = Math.floor(k * 255), bl = Math.floor((1 - k) * 255);
        this.tempLayer.fillStyle((r_ << 16) | (0x30 << 8) | bl, 0.35);
        this.tempLayer.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
  }

  private onResize = () => {
    // Re-clamp scroll after resize so viewport stays inside world
    const cam = this.cameras.main;
    const clamped = clampScroll(this.camScrollX, this.camScrollY, this.camZoom,
      cam.width, cam.height, this.mapPxW, this.mapPxH);
    this.camScrollX = clamped.x;
    this.camScrollY = clamped.y;
    cam.setScroll(this.camScrollX, this.camScrollY);
  };

  private worldToTile(px: number, py: number) {
    const p = this.cameras.main.getWorldPoint(px, py);
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  private onPointerDown = (p: Phaser.Input.Pointer) => {
    if (this.placingType) {
      const t = this.worldToTile(p.x, p.y);
      const res = placeBlueprint(this.state, this.placingType, t.x, t.y);
      if (!res.ok) this.ctx.events.emit('toast', { kind: 'warning', title: 'Стройка', message: res.reason });
      else this.ctx.achievements.unlock('colony.first_building');
      this.placingType = null;
      this.ghost.setVisible(false);
      this.ctx.events.emit('game:state', computeHud(this.state));
      return;
    }
    // Start drag-to-pan
    this.isDragging = true;
    this.dragStartX = p.x;
    this.dragStartY = p.y;
    this.dragScrollStartX = this.camScrollX;
    this.dragScrollStartY = this.camScrollY;
  };

  private onPointerMove = (p: Phaser.Input.Pointer) => {
    if (this.placingType) {
      const t = this.worldToTile(p.x, p.y);
      const ok = canPlace(this.state, t.x, t.y);
      this.ghost.setPosition(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
      this.ghost.setFillStyle(ok ? 0x84de5a : 0xff5a5a, 0.3);
      this.ghost.setVisible(true);
      return;
    }
    if (!this.isDragging) { this.ghost.setVisible(false); return; }
    // Pan: move scroll opposite to pointer delta, corrected for zoom
    const dx = (p.x - this.dragStartX) / this.camZoom;
    const dy = (p.y - this.dragStartY) / this.camZoom;
    const cam = this.cameras.main;
    const clamped = clampScroll(
      this.dragScrollStartX - dx,
      this.dragScrollStartY - dy,
      this.camZoom, cam.width, cam.height, this.mapPxW, this.mapPxH,
    );
    this.camScrollX = clamped.x;
    this.camScrollY = clamped.y;
  };

  private onPointerUp = (p: Phaser.Input.Pointer) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    // If pointer barely moved, treat as a colonist-select click
    const dist = Math.hypot(p.x - this.dragStartX, p.y - this.dragStartY);
    if (dist < 4) {
      const t = this.worldToTile(p.x, p.y);
      let best: Colonist | undefined; let bestD = 1.2;
      for (const c of this.state.colonists) {
        if (!c.alive) continue;
        const d = Math.hypot(c.pos.x - t.x, c.pos.y - t.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) this.ctx.events.emit('colony:select', best.id);
    }
  };

  private onCommand = (msg: { type: string; payload?: any }) => {
    const s = this.state;
    switch (msg.type) {
      case 'speed': s.speed = msg.payload.value; break;
      case 'placeBuilding': this.placingType = msg.payload.building as BuildingType; break;
      case 'cancelPlace': this.placingType = null; this.ghost.setVisible(false); break;
      case 'setPriority': {
        const c = s.colonists.find((x) => x.id === msg.payload.colonistId);
        if (c) c.priorities[msg.payload.job as keyof typeof c.priorities] = msg.payload.value;
        break;
      }
      case 'toggleTempOverlay': this.tempOverlay = !!msg.payload?.value; break;
      case 'restart':
        this.chunks?.destroy();
        this.water?.destroy();
        this.sprites?.destroy();
        this.minimap?.destroy();
        this.scene.restart({ state: createColony(randomSeed()), ctx: this.ctx });
        return;
    }
    this.ctx.events.emit('game:state', computeHud(s));
  };

  update(_t: number, delta: number) {
    const s = this.state;
    if (!s.flags.gameOver && s.speed > 0) {
      this.accumulator += delta * s.speed;
      let safety = 0;
      while (this.accumulator >= this.tickMs && safety < 600) {
        this.accumulator -= this.tickMs;
        safety += 1;
        const newDay = tick(s);
        if (newDay) this.onNewDay();
        if (s.flags.gameOver) break;
      }
    }

    // WASD / arrow key panning
    const panStep = PAN_SPEED / this.camZoom;
    const cam = this.cameras.main;
    let panX = this.camScrollX;
    let panY = this.camScrollY;
    if (this.cursors.left.isDown || this.wasd.left.isDown) panX -= panStep;
    if (this.cursors.right.isDown || this.wasd.right.isDown) panX += panStep;
    if (this.cursors.up.isDown || this.wasd.up.isDown) panY -= panStep;
    if (this.cursors.down.isDown || this.wasd.down.isDown) panY += panStep;

    // Apply zoom + clamped scroll to Phaser camera
    const clamped = clampScroll(panX, panY, this.camZoom, cam.width, cam.height, this.mapPxW, this.mapPxH);
    this.camScrollX = clamped.x;
    this.camScrollY = clamped.y;
    cam.setZoom(this.camZoom);
    cam.setScroll(this.camScrollX, this.camScrollY);

    // Render modules
    this.chunks.update();
    this.water.update(this.time.now);
    this.sprites.update();
    this.minimap.update();
    if (this.tempOverlay) this.drawTempOverlay(); else this.tempLayer.clear();

    this.emitAccum += delta;
    if (this.emitAccum >= 150) {
      this.emitAccum = 0;
      this.ctx.events.emit('game:state', computeHud(s));
    }
  }

  private onNewDay() {
    const s = this.state;
    const pop = alive(s).length;
    this.ctx.achievements.progress('colony.survive_10_days', s.day);
    this.ctx.achievements.progress('colony.population_20', pop);
    this.ctx.records.set('colony.bestDay', s.day, 'max');
    this.ctx.records.set('colony.bestPop', pop, 'max');
    this.ctx.save.autosave(toSave(s), `День ${s.day} · ${pop} жит.`);

    if (s.flags.gameOver) {
      if (s.flags.victory) this.ctx.records.set('colony.victories', 1, 'inc');
      this.ctx.events.emit('game:state', computeHud(s));
      this.ctx.events.emit('toast', {
        kind: s.flags.victory ? 'success' : 'error',
        title: s.flags.victory ? 'Победа' : 'Колония пала',
        message: s.flags.victory ? `Продержались до дня ${s.day}` : `Пали на день ${s.day}`,
        icon: s.flags.victory ? '🏆' : '💀',
      });
    }
  }

  shutdown() {
    this.ctx.events.off('ui:command', this.onCommand);
    this.scale.off('resize', this.onResize, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.onPointerUp, this);
    this.input.off('wheel');
    this.chunks?.destroy();
    this.water?.destroy();
    this.sprites?.destroy();
    this.minimap?.destroy();
  }
}
