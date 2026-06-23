import Phaser from 'phaser';
import { fbm } from '@/core/utils/noise';
import { TEX_DETAIL } from '../../data/balance';
import type { Biome } from '../../domain/types';

export const BIOME_BASE: Record<Biome, [number, number, number]> = {
  water:    [29, 66, 86],
  marsh:    [59, 74, 44],
  meadow:   [79, 125, 51],
  grass:    [52, 86, 36],
  forest:   [33, 56, 26],
  rock:     [74, 72, 64],
  mountain: [120, 118, 110],
};

export const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.floor(n)));

/** Множитель яркости от высоты: низины темнее, возвышенности светлее. */
export function elevationShade(elev: number): number {
  // map elev 0..1 -> 0.72..1.18 (linear, gentle)
  return 0.72 + Math.max(0, Math.min(1, elev)) * 0.46;
}

/** Ambient occlusion на склонах: если сосед намного ниже (обрыв) — затемняем кромку. */
export function slopeAO(elevHere: number, elevNeighborMin: number): number {
  const drop = Math.max(0, elevHere - elevNeighborMin);
  // drop 0 -> 1 (flat); drop 0.3+ -> 0.6 (strong cliff darkening)
  return Math.max(0.6, 1 - drop * 1.33);
}

/** Финальный пиксель тайла: база биома × тень высоты × AO + шумовая деталь. */
export function biomePixel(
  biome: Biome, elev: number, detail: number, elevNeighborMin: number,
): [number, number, number] {
  const base = BIOME_BASE[biome];
  const shade = elevationShade(elev) * slopeAO(elev, elevNeighborMin);
  const d = 1 + detail; // detail in ~[-TEX_DETAIL, +TEX_DETAIL]
  return [
    clampByte(base[0] * shade * d),
    clampByte(base[1] * shade * d),
    clampByte(base[2] * shade * d),
  ];
}

// ---------------------------------------------------------------------------
// Phaser texture generation — biome detail textures + entity sprite textures
// ---------------------------------------------------------------------------

export const BIOMES: Biome[] = ['water', 'marsh', 'meadow', 'grass', 'forest', 'rock', 'mountain'];

/** Returns the Phaser texture key for a biome detail texture. */
export const BIOME_TEX = (b: Biome): string => `col-biome-${b}`;

/** Phaser texture keys for entity sprites. */
export const SPRITE_TEX = {
  tree:     'col-spr-tree',
  rock:     'col-spr-rock',
  berry:    'col-spr-berry',
  colonist: 'col-spr-colonist',
  shadow:   'col-spr-shadow',
};

/**
 * Build one tileable per-biome detail texture for each biome.
 * Uses seeded fbm noise for deterministic results (no Math.random).
 * Must be called once at scene start (or on restart).
 */
export function buildBiomeTextures(scene: Phaser.Scene, seed: number, tilePx: number): void {
  BIOMES.forEach((biome, bi) => {
    const key = BIOME_TEX(biome);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvas = scene.textures.createCanvas(key, tilePx, tilePx);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const img = ctx.createImageData(tilePx, tilePx);
    for (let y = 0; y < tilePx; y++) {
      for (let x = 0; x < tilePx; x++) {
        const detail = (fbm(seed + bi * 131 + 7, x * 0.6, y * 0.6, 3) * 2 - 1) * TEX_DETAIL;
        const [r, g, b] = biomePixel(biome, 0.5, detail, 0.5);
        const o = (y * tilePx + x) * 4;
        img.data[o]     = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.refresh();
  });
}

/**
 * Build all entity sprite textures using Phaser Graphics + generateTexture.
 * All sprites are static (no randomness) — deterministic by construction.
 * Must be called once at scene start (or on restart).
 */
export function buildSpriteTextures(scene: Phaser.Scene, tilePx: number): void {
  const g = scene.add.graphics();
  const s = tilePx;

  const mk = (key: string, w: number, h: number, draw: () => void): void => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  // --- shadow: soft translucent ellipse beneath entities ---
  mk(SPRITE_TEX.shadow, s, Math.round(s * 0.5), () => {
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(s / 2, s * 0.25, s * 0.8, s * 0.4);
  });

  // --- tree: brown trunk + layered green canopy ---
  mk(SPRITE_TEX.tree, s, Math.round(s * 1.4), () => {
    const h = Math.round(s * 1.4);
    // Trunk: thin brown rectangle in lower-centre
    g.fillStyle(0x5a3d22, 1);
    g.fillRect(Math.round(s * 0.44), Math.round(h * 0.60), Math.round(s * 0.12), Math.round(h * 0.38));
    // Canopy lower layer (wider, darker green)
    g.fillStyle(0x2e5826, 1);
    g.fillCircle(Math.round(s * 0.50), Math.round(h * 0.48), Math.round(s * 0.38));
    // Canopy upper layer (lighter green highlight)
    g.fillStyle(0x3f6b32, 1);
    g.fillCircle(Math.round(s * 0.50), Math.round(h * 0.36), Math.round(s * 0.28));
    // Small top highlight
    g.fillStyle(0x52882a, 1);
    g.fillCircle(Math.round(s * 0.50), Math.round(h * 0.22), Math.round(s * 0.16));
  });

  // --- rock: grey faceted boulder shape ---
  mk(SPRITE_TEX.rock, s, Math.round(s * 0.85), () => {
    const h = Math.round(s * 0.85);
    // Main body: large dark-grey ellipse
    g.fillStyle(0x4a4a44, 1);
    g.fillEllipse(s / 2, h * 0.55, s * 0.78, h * 0.72);
    // Mid facet: medium lighter-grey ellipse slightly offset
    g.fillStyle(0x6b6b63, 1);
    g.fillEllipse(s * 0.46, h * 0.46, s * 0.56, h * 0.52);
    // Top highlight: small pale grey ellipse
    g.fillStyle(0x8c8c82, 1);
    g.fillEllipse(s * 0.40, h * 0.30, s * 0.28, h * 0.22);
  });

  // --- berry: small green bush with red berry dots ---
  mk(SPRITE_TEX.berry, s, Math.round(s * 0.9), () => {
    const h = Math.round(s * 0.9);
    // Bush body: dark green ellipse base
    g.fillStyle(0x2e5826, 1);
    g.fillEllipse(s * 0.50, h * 0.62, s * 0.82, h * 0.62);
    // Bush highlight: lighter green top
    g.fillStyle(0x3f6b32, 1);
    g.fillEllipse(s * 0.46, h * 0.50, s * 0.58, h * 0.44);
    // Berry dots (five red berries scattered on upper bush)
    g.fillStyle(0xc0392b, 1);
    const bd = Math.round(s * 0.09);
    g.fillCircle(Math.round(s * 0.32), Math.round(h * 0.40), bd);
    g.fillCircle(Math.round(s * 0.52), Math.round(h * 0.34), bd);
    g.fillCircle(Math.round(s * 0.68), Math.round(h * 0.42), bd);
    g.fillCircle(Math.round(s * 0.42), Math.round(h * 0.56), Math.round(s * 0.07));
    g.fillCircle(Math.round(s * 0.62), Math.round(h * 0.54), Math.round(s * 0.07));
  });

  // --- colonist: rounded body + head circle (task-neutral colours) ---
  mk(SPRITE_TEX.colonist, s, Math.round(s * 1.2), () => {
    const h = Math.round(s * 1.2);
    // Body shadow base
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(s * 0.50, h * 0.94, s * 0.50, h * 0.10);
    // Body: capsule shape — ellipse (torso) + rectangle core
    g.fillStyle(0xcfe0c0, 1);
    g.fillRoundedRect(
      Math.round(s * 0.30), Math.round(h * 0.44),
      Math.round(s * 0.40), Math.round(h * 0.46),
      Math.round(s * 0.10),
    );
    // Head: circle above body
    g.fillStyle(0xe8d8b0, 1);
    g.fillCircle(Math.round(s * 0.50), Math.round(h * 0.28), Math.round(s * 0.18));
    // Simple face marker: two small dark eye dots
    g.fillStyle(0x3a2a1a, 1);
    const ey = Math.round(h * 0.26);
    g.fillCircle(Math.round(s * 0.44), ey, Math.round(s * 0.04));
    g.fillCircle(Math.round(s * 0.56), ey, Math.round(s * 0.04));
  });

  g.destroy();
}
