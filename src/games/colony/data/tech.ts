export interface TechDef {
  id: string;
  name: string;
  desc: string;
  cost: number; // science
  requires?: string[];
}

/** MVP 0.2 tech tree. Effects are applied in systems/simulation.ts. */
export const TECHS: TechDef[] = [
  { id: 'tools', name: 'Инструменты', desc: '+25% ко всей добыче', cost: 40 },
  { id: 'irrigation', name: 'Орошение', desc: '+30% к производству еды', cost: 60, requires: ['tools'] },
  { id: 'medicine', name: 'Медицина', desc: 'Жители быстрее восстанавливают здоровье', cost: 80, requires: ['tools'] },
];

export const techById = (id: string) => TECHS.find((t) => t.id === id);
