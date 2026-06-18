export type AchievementScope = 'global' | 'colony' | 'shadow';

export interface AchievementDefinition {
  id: string; // e.g. 'colony.survive_10_days'
  scope: AchievementScope;
  title: string;
  description: string;
  icon: string; // emoji / glyph for the badge
  hidden: boolean;
  type: 'boolean' | 'counter';
  target?: number; // required for counter
  points: number;
}

export interface AchievementProgress {
  id: string;
  unlocked: boolean;
  unlockedAt?: string;
  current: number;
  target: number;
}
