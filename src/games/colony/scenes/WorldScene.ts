import Phaser from 'phaser';
import type { GameContext } from '@/types/game-module';
import type { ColonyState, Colonist } from '../domain/types';
import { TICKS_PER_DAY } from '../data/balance';
import { alive, allTechResearched, computeHud, moveJob, tick, tryBuild, tryResearch } from '../systems/simulation';
import { createColony } from '../domain/createColony';
import { randomSeed } from '@/core/utils/rng';

const TILE = 22;

const TERRAIN_COLOR: Record<string, number> = {
  grass: 0x223018,
  forest: 0x1b2a12,
  rock: 0x2c2c26,
  water: 0x16263a,
};

const BUILDING_COLOR: Record<string, number> = { farm: 0x84de5a, house: 0xf0a840, lab: 0x4ad0ff };
const BUILDING_GLYPH: Record<string, string> = { farm: 'F', house: 'H', lab: 'L' };
const JOB_COLOR: Record<string, number> = {
  farmer: 0x84de5a,
  lumberjack: 0xf0a840,
  researcher: 0x4ad0ff,
  idle: 0x8aa884,
};

interface Dot {
  go: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  ref: Colonist;
}

export class WorldScene extends Phaser.Scene {
  private state!: ColonyState;
  private ctx!: GameContext;
  private accumulator = 0;
  private emitAccum = 0;
  private readonly tickMs = 1000 / 8; // 8 ticks/sec at 1x
  private dots: Dot[] = [];
  private buildingLayer!: Phaser.GameObjects.Container;
  private dotLayer!: Phaser.GameObjects.Container;
  private lastBuildingCount = -1;
  private mapPxW = 0;
  private mapPxH = 0;
  private firstBuildDone = false;

  constructor() {
    super('world');
  }

  init(data: { state: ColonyState; ctx: GameContext }) {
    this.state = data.state;
    this.ctx = data.ctx;
    this.firstBuildDone = this.state.buildings.length > 0;
  }

  create() {
    this.mapPxW = this.state.map.w * TILE;
    this.mapPxH = this.state.map.h * TILE;
    this.cameras.main.setBackgroundColor('#0d140c');

    this.drawMap();
    this.buildingLayer = this.add.container(0, 0);
    this.dotLayer = this.add.container(0, 0);
    this.spawnDots();

    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);

    // HUD → scene commands.
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

  private syncBuildings() {
    if (this.state.buildings.length === this.lastBuildingCount) return;
    this.lastBuildingCount = this.state.buildings.length;
    this.buildingLayer.removeAll(true);
    for (const b of this.state.buildings) {
      const x = b.tx * TILE;
      const y = b.ty * TILE;
      const rect = this.add.rectangle(x + TILE / 2, y + TILE / 2, TILE - 2, TILE - 2, BUILDING_COLOR[b.type], 0.92);
      rect.setStrokeStyle(1, 0x000000, 0.3);
      const text = this.add
        .text(x + TILE / 2, y + TILE / 2, BUILDING_GLYPH[b.type], {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#0d140c',
        })
        .setOrigin(0.5);
      this.buildingLayer.add([rect, text]);
    }
  }

  private spawnDots() {
    this.dotLayer.removeAll(true);
    this.dots = [];
    const cx = this.mapPxW / 2;
    const cy = this.mapPxH / 2;
    for (const c of this.state.colonists) {
      if (!c.alive) continue;
      const go = this.add.circle(
        cx + (Math.random() - 0.5) * TILE * 5,
        cy + (Math.random() - 0.5) * TILE * 5,
        4,
        JOB_COLOR[c.job],
      );
      go.setStrokeStyle(1, 0x000000, 0.4);
      this.dotLayer.add(go);
      this.dots.push({ go, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, ref: c });
    }
  }

  private fitCamera = () => {
    const cam = this.cameras.main;
    const zoom = Math.min(cam.width / this.mapPxW, cam.height / this.mapPxH) * 0.92;
    cam.setZoom(Math.max(0.5, zoom));
    cam.centerOn(this.mapPxW / 2, this.mapPxH / 2);
  };

  private onCommand = (msg: { type: string; payload?: any }) => {
    const s = this.state;
    switch (msg.type) {
      case 'build': {
        const res = tryBuild(s, msg.payload.building);
        if (res.ok) {
          this.ctx.achievements.unlock('colony.first_building');
          this.firstBuildDone = true;
        } else {
          this.ctx.events.emit('toast', { kind: 'warning', title: 'Стройка', message: res.reason });
        }
        break;
      }
      case 'research': {
        const res = tryResearch(s, msg.payload.techId);
        if (res.ok) {
          this.ctx.achievements.unlock('colony.first_tech');
          if (allTechResearched(s)) this.ctx.achievements.unlock('colony.all_tech');
        } else {
          this.ctx.events.emit('toast', { kind: 'warning', title: 'Наука', message: res.reason });
        }
        break;
      }
      case 'assign':
        moveJob(s, msg.payload.job, msg.payload.dir);
        break;
      case 'speed':
        s.speed = msg.payload.value;
        break;
      case 'restart':
        this.lastBuildingCount = -1;
        this.scene.restart({ state: createColony(randomSeed()), ctx: this.ctx });
        return;
    }
    this.ctx.events.emit('game:state', computeHud(s));
  };

  update(_time: number, delta: number) {
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
    if (this.dots.filter((d) => d.ref.alive).length !== alive(s).length) this.spawnDots();
    this.wanderDots(delta);

    // Throttle HUD updates.
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

    // Records (bests).
    this.ctx.records.set('colony.bestDay', s.day, 'max');
    this.ctx.records.set('colony.bestPop', pop, 'max');

    // Threat: a repelled raid this day unlocks the achievement.
    if (s.log.some((l) => l.day === s.day && l.tag === 'raid_repelled')) {
      this.ctx.achievements.unlock('colony.repel_raid');
    }

    this.ctx.save.autosave(s, `День ${s.day} · ${pop} жит.`);

    if (s.flags.gameOver) {
      if (s.flags.victory) this.ctx.records.set('colony.victories', 1, 'inc');
      this.ctx.events.emit('game:state', computeHud(s));
      this.ctx.events.emit('toast', {
        kind: s.flags.victory ? 'success' : 'error',
        title: s.flags.victory ? 'Победа' : 'Колония пала',
        message: s.flags.victory ? `Процветание на день ${s.day}` : `Продержались ${s.day} дн.`,
        icon: s.flags.victory ? '🏆' : '💀',
      });
    }
  }

  private wanderDots(delta: number) {
    const dt = delta / 1000;
    const cx = this.mapPxW / 2;
    const cy = this.mapPxH / 2;
    const range = TILE * 7;
    for (const d of this.dots) {
      d.go.setFillStyle(JOB_COLOR[d.ref.job]);
      d.go.setAlpha(d.ref.health < 35 ? 0.45 : 0.95);
      d.go.x += d.vx * dt;
      d.go.y += d.vy * dt;
      if (Math.abs(d.go.x - cx) > range) d.vx *= -1;
      if (Math.abs(d.go.y - cy) > range) d.vy *= -1;
      if (Math.random() < 0.02) {
        d.vx = (Math.random() - 0.5) * 14;
        d.vy = (Math.random() - 0.5) * 14;
      }
    }
  }

  shutdown() {
    this.ctx.events.off('ui:command', this.onCommand);
    this.scale.off('resize', this.fitCamera, this);
  }
}

export { TICKS_PER_DAY };
