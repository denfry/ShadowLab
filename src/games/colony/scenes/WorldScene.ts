import Phaser from 'phaser';
import type { GameContext } from '@/types/game-module';
import type { BuildingType, ColonyState, Colonist } from '../domain/types';
import { TILE } from '../data/balance';
import { tick, alive } from '../systems/tick';
import { computeHud } from '../systems/projection';
import { placeBlueprint, canPlace } from '../systems/build';
import { createColony } from '../domain/createColony';
import { toSave } from '../domain/save';
import { randomSeed } from '@/core/utils/rng';

const TERRAIN_COLOR: Record<string, number> = {
  grass: 0x223018, forest: 0x1b2a12, rock: 0x2c2c26, water: 0x16263a,
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
  private buildingLayer!: Phaser.GameObjects.Container;
  private dotLayer!: Phaser.GameObjects.Container;
  private tempLayer!: Phaser.GameObjects.Graphics;
  private tempOverlay = false;
  private lastBuildSig = '';
  private placingType: BuildingType | null = null;
  private ghost!: Phaser.GameObjects.Rectangle;

  constructor() { super('world'); }

  init(data: { state: ColonyState; ctx: GameContext }) {
    this.state = data.state;
    this.ctx = data.ctx;
  }

  create() {
    this.mapPxW = this.state.map.w * TILE;
    this.mapPxH = this.state.map.h * TILE;
    this.cameras.main.setBackgroundColor('#0d140c');
    this.drawMap();
    this.tempLayer = this.add.graphics();
    this.buildingLayer = this.add.container(0, 0);
    this.dotLayer = this.add.container(0, 0);
    this.spawnDots();

    this.ghost = this.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0.25).setVisible(false);
    this.ghost.setStrokeStyle(1, 0xffffff, 0.6);

    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    this.ctx.events.on('ui:command', this.onCommand);
    this.ctx.events.emit('game:state', computeHud(this.state));
  }

  private drawMap() {
    const g = this.add.graphics();
    for (const t of this.state.map.tiles) {
      g.fillStyle(TERRAIN_COLOR[t.terrain] ?? 0x222222, 1);
      g.fillRect(t.x * TILE, t.y * TILE, TILE - 1, TILE - 1);
    }
    g.lineStyle(1, 0x000000, 0.15);
    g.strokeRect(0, 0, this.mapPxW, this.mapPxH);
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
    for (const t of this.state.map.tiles) {
      // синий (холод) → красный (тепло), диапазон -20..30
      const k = Math.max(0, Math.min(1, (t.temp + 20) / 50));
      const r = Math.floor(k * 255), b = Math.floor((1 - k) * 255);
      this.tempLayer.fillStyle((r << 16) | (0x30 << 8) | b, 0.35);
      this.tempLayer.fillRect(t.x * TILE, t.y * TILE, TILE - 1, TILE - 1);
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

  private fitCamera = () => {
    const cam = this.cameras.main;
    const zoom = Math.min(cam.width / this.mapPxW, cam.height / this.mapPxH) * 0.92;
    cam.setZoom(Math.max(0.5, zoom));
    cam.centerOn(this.mapPxW / 2, this.mapPxH / 2);
  };

  private worldToTile(px: number, py: number) {
    const p = this.cameras.main.getWorldPoint(px, py);
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  private onPointerMove = (p: Phaser.Input.Pointer) => {
    if (!this.placingType) { this.ghost.setVisible(false); return; }
    const t = this.worldToTile(p.x, p.y);
    const ok = canPlace(this.state, t.x, t.y);
    this.ghost.setPosition(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
    this.ghost.setFillStyle(ok ? 0x84de5a : 0xff5a5a, 0.3);
    this.ghost.setVisible(true);
  };

  private onPointerDown = (p: Phaser.Input.Pointer) => {
    const t = this.worldToTile(p.x, p.y);
    if (this.placingType) {
      const res = placeBlueprint(this.state, this.placingType, t.x, t.y);
      if (!res.ok) this.ctx.events.emit('toast', { kind: 'warning', title: 'Стройка', message: res.reason });
      else this.ctx.achievements.unlock('colony.first_building');
      this.placingType = null;
      this.ghost.setVisible(false);
      this.ctx.events.emit('game:state', computeHud(this.state));
      return;
    }
    // Иначе — выбор колониста рядом с кликом.
    let best: Colonist | undefined; let bestD = 1.2;
    for (const c of this.state.colonists) {
      if (!c.alive) continue;
      const d = Math.hypot(c.pos.x - t.x, c.pos.y - t.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) this.ctx.events.emit('colony:select', best.id);
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
    this.scale.off('resize', this.fitCamera, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);
  }
}
