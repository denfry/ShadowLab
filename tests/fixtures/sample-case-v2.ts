import type { CaseV2 } from '@/games/shadow-trace/engine/types';

/**
 * Minimal but fully valid v2 case used across engine tests.
 * Two suspects, a fake photo whose metadata time (21:30) contradicts Eron's
 * statement (home at 22:00). Finding that contradiction unlocks the lab node.
 */
export const sampleCase: CaseV2 = {
  id: 'sample',
  title: 'Образец дела',
  difficulty: 'hard',
  synopsis: 'Тестовое дело для движка.',
  startNodeIds: ['n_scene', 'n_interview'],
  flagsSchema: [{ id: 'lab_done', description: 'Лаборатория отработана' }],
  suspects: [
    { id: 's_eron', name: 'Эрон', role: 'ассистент', alibi: 'Был дома', truthProfile: { wasAt: 'office' } },
    { id: 's_mara', name: 'Мара', role: 'куратор', alibi: 'На приёме' },
  ],
  statements: [
    {
      id: 'st_eron_home',
      speakerId: 's_eron',
      claim: 'Я был дома в 22:00.',
      asserts: { subjectId: 's_eron', place: 'home', timeStart: '22:00', timeEnd: '23:00' },
    },
  ],
  evidence: [
    {
      id: 'e_photo',
      title: 'Снимок у входа',
      kind: 'photo',
      summary: 'Фигура у служебного входа.',
      authenticity: 'fake',
      relatedSuspectIds: ['s_eron'],
      metadata: { time: '21:30', geo: 'office', device: 'CCTV-3' },
      media: {
        kind: 'photo',
        aspect: '4:3',
        style: 'cctv',
        layers: [{ id: 'bg', z: 0, shape: 'rect', at: { x: 0, y: 0, w: 100, h: 100 } }],
        hotspots: [{ id: 'h_clock', at: { x: 10, y: 10, w: 20, h: 20 }, label: 'Часы на стене: 21:30' }],
        artifacts: [{ id: 'a_clock', type: 'clock_conflict', tell: 'Время на часах не бьётся с показанием' }],
      },
    },
    {
      id: 'e_log',
      title: 'Журнал доступа',
      kind: 'log',
      summary: 'Карта Эрона открыла дверь в 21:28.',
      content: '21:28 ACCESS GRANTED card=ERON',
      authenticity: 'real',
      relatedSuspectIds: ['s_eron'],
    },
  ],
  contradictions: [
    {
      id: 'c_time',
      between: [
        { type: 'statement', refId: 'st_eron_home' },
        { type: 'metadata', refId: 'e_photo' },
      ],
      rule: 'time_overlap',
      unlocks: [{ addNode: 'n_lab' }],
      weight: 2,
    },
  ],
  nodes: [
    {
      id: 'n_scene',
      type: 'location',
      title: 'Осмотр входа',
      body: ['У служебного входа лежит распечатка кадра.'],
      grants: [{ addEvidence: 'e_photo' }],
      oneShot: true,
    },
    {
      id: 'n_interview',
      type: 'interrogation',
      title: 'Допрос Эрона',
      body: ['— Я был дома весь вечер.'],
      grants: [{ addStatement: 'st_eron_home' }],
    },
    {
      id: 'n_lab',
      type: 'analysis',
      title: 'Лаборатория',
      requires: { foundContradiction: 'c_time' },
      body: ['Эксперт сверяет журнал доступа.'],
      grants: [{ addEvidence: 'e_log' }, { setFlag: 'lab_done' }],
    },
  ],
  endings: [
    {
      id: 'end_truth',
      title: 'Истина установлена',
      requires: { all: [{ foundContradiction: 'c_time' }, { hasFlag: 'lab_done' }, { accuse: 's_eron' }] },
      quality: 'truth',
      epilogue: ['Эрон сломался под тяжестью улик.'],
      campaignEffects: [{ setFlag: 'eron_jailed' }],
    },
    {
      id: 'end_partial',
      title: 'Верно, но шатко',
      requires: { accuse: 's_eron' },
      quality: 'partial',
      epilogue: ['Эрон задержан, но защита найдёт бреши.'],
    },
    {
      id: 'end_miscarriage',
      title: 'Осуждён невиновный',
      requires: { accuse: 's_mara' },
      quality: 'miscarriage',
      epilogue: ['Мара осуждена. Настоящий виновный на свободе.'],
    },
    {
      id: 'end_cold',
      title: 'Глухарь',
      requires: { all: [] },
      quality: 'cold_case',
      epilogue: ['Улик не хватило.'],
    },
  ],
};
