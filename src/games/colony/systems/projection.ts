import type { BuildingType, ColonyHudState, ColonyState } from '../domain/types';
import { topSkill } from '../domain/skills';

export function computeHud(s: ColonyState): ColonyHudState {
  const alive = s.colonists.filter((c) => c.alive);
  const buildingCounts: Record<BuildingType, number> = { bedroom: 0, storage: 0, lab: 0, wall: 0, door: 0, heater: 0, tailor: 0, bridge: 0, tunnel: 0 };
  for (const b of s.buildings) if (b.built) buildingCounts[b.type] += 1;

  return {
    day: s.day,
    phase: s.phase,
    speed: s.speed,
    population: alive.length,
    env: { ...s.env },
    clothing: s.stock.clothing,
    resources: {
      food: { ...s.resources.food },
      wood: { ...s.resources.wood },
      science: { ...s.resources.science },
      stone: { ...s.resources.stone },
      clay: { ...s.resources.clay },
      iron: { ...s.resources.iron },
      gold: { ...s.resources.gold },
      fiber: { ...s.resources.fiber },
    },
    colonists: alive.map((c) => ({
      id: c.id,
      name: c.name,
      traits: [...c.traits],
      task: c.task,
      hunger: Math.round(c.needs.hunger),
      fatigue: Math.round(c.needs.fatigue),
      health: Math.round(c.health),
      topSkill: topSkill(c.skills),
      priorities: { ...c.priorities },
      cold: Math.round(c.needs.cold),
      clothed: c.clothed,
    })),
    buildingCounts,
    log: s.log.slice(-8).reverse(),
    gameOver: s.flags.gameOver,
    victory: s.flags.victory,
  };
}
