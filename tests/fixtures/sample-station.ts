import type { Station } from '@/games/among-the-quiet/engine/types';

export const sampleStation: Station = {
  id: 'sample',
  title: 'Тихая станция',
  synopsis: 'Тестовая станция для движка.',
  difficulty: 'tense',
  days: 4,
  slotsPerDay: 4,
  startSuspicion: 5,
  tuning: {
    suspicionGain: 20,
    gossipStrength: 15,
    detectionMult: 1,
    paranoiaEscalation: 1,
    composureCost: 25,
    composureRegen: 15,
  },
  locations: [
    { id: 'commons', name: 'Кают-компания', exposure: 'public' },
    { id: 'comms', name: 'Связь', exposure: 'semi' },
    { id: 'vault', name: 'Хранилище', exposure: 'private', objectiveStepIds: ['s_grab'] },
  ],
  crew: [
    {
      id: 'mara', name: 'Мара', role: 'связистка', traits: ['nosy', 'sharp'], watchfulness: 1,
      readStyle: 'sharp_reader',
      routine: { 0: [{ locationId: 'commons', weight: 1 }], 1: [{ locationId: 'comms', weight: 1 }], 2: [{ locationId: 'commons', weight: 1 }], 3: [{ locationId: 'comms', weight: 1 }] },
      relationships: [{ npcId: 'theo', bond: 60 }, { npcId: 'stein', bond: -10 }],
    },
    {
      id: 'theo', name: 'Тэо', role: 'кок', traits: ['gossip', 'anxious'], watchfulness: 0.2,
      readStyle: 'soft_reader',
      routine: { 0: [{ locationId: 'commons', weight: 1 }], 1: [{ locationId: 'commons', weight: 1 }], 2: [{ locationId: 'commons', weight: 1 }], 3: [{ locationId: 'commons', weight: 1 }] },
      relationships: [{ npcId: 'mara', bond: 60 }],
    },
    {
      id: 'stein', name: 'Стайн', role: 'механик', traits: ['loner'], watchfulness: 0.3,
      readStyle: 'soft_reader',
      routine: { 0: [{ locationId: 'vault', weight: 1 }], 1: [{ locationId: 'vault', weight: 1 }], 2: [{ locationId: 'comms', weight: 1 }], 3: [{ locationId: 'commons', weight: 1 }] },
      relationships: [{ npcId: 'mara', bond: -10 }],
    },
    {
      id: 'lina', name: 'Лина', role: 'медик', traits: ['trusting', 'loyal'], watchfulness: 0.4,
      readStyle: 'soft_reader',
      routine: { 0: [{ locationId: 'comms', weight: 1 }], 1: [{ locationId: 'commons', weight: 1 }], 2: [{ locationId: 'commons', weight: 1 }], 3: [{ locationId: 'commons', weight: 1 }] },
      relationships: [{ npcId: 'theo', bond: 40 }],
    },
  ],
  objectives: [
    {
      id: 'obj_blackbox',
      title: 'Вынести чёрный ящик',
      steps: [
        { id: 's_grab', label: 'Забрать ящик', locationId: 'vault', baseRisk: 1, leavesTrace: { severity: 1, discoverableBy: 'any' } },
      ],
    },
  ],
  cueLibrary: [
    {
      readStyle: 'sharp_reader',
      bands: {
        trust: [{ channel: 'dialogue', text: 'кивает спокойно' }],
        wary: [{ channel: 'tell', text: 'задерживает на тебе взгляд' }],
        cold: [{ channel: 'tell', text: 'замолкает, когда ты входишь' }],
        accusing: [{ channel: 'meeting', text: 'прямо смотрит на {target}' }],
      },
    },
    {
      readStyle: 'soft_reader',
      bands: {
        trust: [{ channel: 'dialogue', text: 'болтает как ни в чём не бывало' }],
        wary: [{ channel: 'dialogue', text: 'отвечает чуть суше' }],
        cold: [{ channel: 'tell', text: 'садится дальше от тебя' }],
        accusing: [{ channel: 'meeting', text: 'нервно косится на {target}', traitGate: 'gossip' }],
      },
    },
  ],
};
