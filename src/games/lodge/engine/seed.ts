// Minimal forward declaration so `import type { Rng }` in types.ts resolves
// under `tsc` before Task 2 lands the full RNG. Task 2 OVERWRITES this file.
export type Rng = () => number;
