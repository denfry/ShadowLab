import type { SkillId, Skill } from './types';

export const SKILL_IDS: SkillId[] = [
  'farming', 'woodcutting', 'building', 'research', 'cooking', 'medicine', 'shooting', 'melee',
];

export const SKILL_NAMES: Record<SkillId, string> = {
  farming: 'Земледелие', woodcutting: 'Лесорубство', building: 'Строительство',
  research: 'Исследования', cooking: 'Готовка', medicine: 'Медицина',
  shooting: 'Стрельба', melee: 'Ближний бой',
};

export const emptySkills = (): Record<SkillId, Skill> =>
  SKILL_IDS.reduce((acc, id) => {
    acc[id] = { level: 0, xp: 0 };
    return acc;
  }, {} as Record<SkillId, Skill>);

/** Множитель выработки от уровня навыка: 1.0 на 0 уровне, +8% за уровень. */
export const skillMultiplier = (level: number): number => 1 + level * 0.08;

/** Начисляет xp и поднимает уровень каждые 100 xp (кап 20). */
export function grantXp(skill: Skill, amount: number): void {
  skill.xp += amount;
  while (skill.xp >= 100 && skill.level < 20) {
    skill.xp -= 100;
    skill.level += 1;
  }
  if (skill.level >= 20) skill.xp = 0;
}

export const topSkill = (skills: Record<SkillId, Skill>): { id: SkillId; level: number } => {
  let best: SkillId = SKILL_IDS[0];
  for (const id of SKILL_IDS) if (skills[id].level > skills[best].level) best = id;
  return { id: best, level: skills[best].level };
};
