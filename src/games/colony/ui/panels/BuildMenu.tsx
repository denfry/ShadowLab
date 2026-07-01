import type { BuildingType } from '../../domain/types';
import { BUILD_COST } from '../../data/balance';
import { BUILDABLE, BUILDING_LABEL } from '../../data/buildings';

const GLYPH: Record<BuildingType, string> = {
  farm: '🌾', bedroom: '🛏️', storage: '📦', lab: '🔬',
  wall: '🧱', door: '🚪', heater: '🔥', tailor: '🪡', bridge: '🌉', tunnel: '⛏️',
};

export function BuildMenu({ onPick }: { onPick: (b: BuildingType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUILDABLE.map((b) => (
        <button
          key={b}
          onClick={() => onPick(b)}
          className="rounded-xl border border-edge/60 p-2 text-center transition-all hover:border-accent/50"
        >
          <span className="block text-lg">{GLYPH[b]}</span>
          <span className="block font-display text-[0.7rem] text-ink">{BUILDING_LABEL[b]}</span>
          <span className="block font-mono text-[0.6rem] text-muted">
            {BUILD_COST[b].wood ? `${BUILD_COST[b].wood}🪵 ` : ''}{BUILD_COST[b].stone ? `${BUILD_COST[b].stone}🪨` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
