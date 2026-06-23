import Phaser from 'phaser';
import type { GameContext } from '@/types/game-module';
import type { BuildingType, ColonyState, Colonist } from '../domain/types';
import { TILE } from '../data/balance';
import { tick, alive } from '../systems/tick';
import { computeHud } from '../systems/projection';
import { placeBlueprint, canPlace } from '../systems/build';
import { biomeAt, tempAt } from '../systems/grid';
import { createColony } from '../domain/createColony';
import { toSave } from '../domain/save';
import { randomSeed } from '@/core/utils/rng';
import { visibleTileRange, clampScroll } from './cameraMath';

const BIOME_COLOR: Record<string, number> = {
  water: 0x1d4256, marsh: 0x3b4a2c, meadow: 0x4f7d33, grass: 0x223018,
  forest: 0x1b2a12, rock: 0x2c2c26, mountain: 0x4a4a44,
};
const BUILDING_COLOR: Record<BuildingType, number> = {
  farm: 0x84de5a, bedroom: 0xf0a840, storage: 0xc8b88a, lab: 0x4ad0ff,
  wall: 0x6b6b63, door: 0xa6895b, heater: 0xff6a3d, tailor: 0xb98bd9,
};
const BUILDING_GLYPH: Record<BuildingType, string> = {
  farm: 'F', bedroom: 'H', storage: 'S', lab: 'L', wall: '#', door: '/', heater: '*', tailor: 'T',
};
const TASK_COLOR: Record<string, number> = {
  work: 0x84de5a, goto_work: 0xbfe89a, eat: 0xf0a840, goto_eat: 0xf0c890,
  sleep: 0x6aa0ff, goto_sleep: 0x9ab8ff, idle: 0x8aa884,
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;
const PAN_SPEED = 8; // world-px per frame at zoom=1

interface Dot { go: Phaser.GameObjects.Arc; ref: Colonist; }

export class WorldScene extends Phaser.Scene {
  private state!: ColonyState;
  private ctx!: GameContext;
  private accumulator = 0;
  private emitAccum = 0;
  private readonly tickMs = 1000 / 8;
  private dots: Dot[] = [];
  private mapPxW = 0;
  private mapPxH = 0;
  private mapLayer!: Phaser.GameObjects.Graphics;
  private buildingLayer!: Phaser.GameObjects.Container;
  private dotLayer!: Phaser.GameObjects.Container;
  private tempLayer!: Phaser.GameObjects.Graphics;
  private tempOverlay = false;
  private lastBuildSig = '';
  private placingType: BuildingType | null = null;
  private ghost!: Phaser.GameObjects.Rectangle;

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

    // Map layer — redrawn each frame (culled to visible tiles)
    this.mapLayer = this.add.graphics();

    this.tempLayer = this.add.graphics();
    this.buildingLayer = this.add.container(0, 0);
    this.dotLayer = this.add.container(0, 0);
    this.spawnDots();

    this.ghost = this.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0.25).setVisible(false);
    this.ghost.setStrokeStyle(1, 0xffffff, 0.6);

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
    this.ctx.events.emit('game:state', computeHud(this.state));

    // Initial map draw
    this.redrawMap();
  }

  private redrawMap() {
    const cam = this.cameras.main;
    const r = visibleTileRange(
      cam.scrollX, cam.scrollY, cam.zoom,
      cam.width, cam.height,
      TILE, this.state.map.w, this.state.map.h,
    );
    this.mapLayer.clear();
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const b = biomeAt(this.state.map, x, y) ?? 'grass';
        this.mapLayer.fillStyle(BIOME_COLOR[b] ?? 0x222222, 1);
        this.mapLayer.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
      }
    }
    this.mapLayer.lineStyle(1, 0x000000, 0.15);
    this.mapLayer.strokeRect(0, 0, this.mapPxW, this.mapPxH);
  }

  private buildSig() {
    return this.state.buildings.map((b) => `${b.id}:${b.built ? 1 : 0}`).join('|');
  }

  private syncBuildings() {
    const sig = this.buildSig();
    if (sig === this.lastBuildSig) return;
    this.lastBuildSig = sig;
    this.buildingLayer.removeAll(true);
    for (const b of this.state.buildings) {
      const x = b.tile.x * TILE;
      const y = b.tile.y * TILE;
      const rect = this.add.rectangle(x + TILE / 2, y + TILE / 2, TILE - 2, TILE - 2, BUILDING_COLOR[b.type], b.built ? 0.92 : 0.35);
      rect.setStrokeStyle(1, 0x000000, 0.3);
      const text = this.add.text(x + TILE / 2, y + TILE / 2, BUILDING_GLYPH[b.type], {
        fontFamily: 'monospace', fontSize: '12px', color: '#0d140c',
      }).setOrigin(0.5);
      this.buildingLayer.add([rect, text]);
    }
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

  private spawnDots() {
    this.dotLayer.removeAll(true);
    this.dots = [];
    for (const c of this.state.colonists) {
      if (!c.alive) continue;
      const go = this.add.circle(c.pos.x * TILE + TILE / 2, c.pos.y * TILE + TILE / 2, 4, TASK_COLOR[c.task]);
      go.setStrokeStyle(1, 0x000000, 0.4);
      this.dotLayer.add(go);
      this.dots.push({ go, ref: c });
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
        this.lastBuildSig = '';
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

    // Redraw culled map + temp overlay every frame
    this.redrawMap();
    this.syncBuildings();
    this.drawTempOverlay();

    if (this.dots.filter((d) => d.ref.alive).length !== alive(s).length) this.spawnDots();
    for (const d of this.dots) {
      d.go.setPosition(d.ref.pos.x * TILE + TILE / 2, d.ref.pos.y * TILE + TILE / 2);
      d.go.setFillStyle(TASK_COLOR[d.ref.task] ?? 0x8aa884);
      d.go.setAlpha(d.ref.health < 35 ? 0.45 : 0.95);
    }

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
  }
}
