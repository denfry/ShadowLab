import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('accessor seam', () => {
  it('no .tiles access outside systems/grid.ts', () => {
    const root = 'src/games/colony';
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.ts')) continue;
        if (p.endsWith('grid.ts')) continue; // the only place the backend lives
        if (/\.tiles\b/.test(readFileSync(p, 'utf8'))) offenders.push(p.replace(/\\/g, '/'));
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
