// tests/fixtures/sample-archive-case.ts
import type { CaseArchive } from '@/games/shadow-trace/archive/types';

/**
 * Solvable Эрон/Мара case in the archive model.
 * Thread: report+interrogation (seeds) → CCTV photo (reveals the admin) →
 * admin chat (grants the archive key) → unsealed access log. The decisive lie:
 * Эрон says "home at 22:00" but his card opened the office door at 21:28.
 */
export const sampleArchiveCase: CaseArchive = {
  id: 'sample-archive',
  title: 'Образец: архив дела',
  difficulty: 'hard',
  synopsis: 'Тестовое дело для архивного движка.',
  seedRecordIds: ['r_report', 'r_eron'],
  keysSchema: [{ id: 'k_archive', label: 'Доступ к закрытому архиву' }],
  entities: [
    { id: 's_eron', type: 'person', label: 'Эрон', isSuspect: true, summary: 'Ассистент лаборатории.' },
    { id: 's_mara', type: 'person', label: 'Мара', isSuspect: true, summary: 'Куратор проекта.' },
    { id: 's_admin', type: 'person', label: 'Кат (администратор)', summary: 'Администратор СКУД.' },
    { id: 'p_office', type: 'place', label: 'офис' },
    { id: 't_2200', type: 'time', label: '22:00' },
    { id: 't_2130', type: 'time', label: '21:30' },
    { id: 't_2128', type: 'time', label: '21:28' },
    { id: 'o_card', type: 'object', label: 'пропуск-карта' },
    { id: 'ev_cctv', type: 'event', label: 'съёмка CCTV' },
  ],
  media: [
    {
      id: 'm_cctv',
      media: {
        kind: 'photo',
        aspect: '4:3',
        style: 'cctv',
        layers: [{ id: 'bg', z: 0, shape: 'rect', at: { x: 0, y: 0, w: 100, h: 100 } }],
        hotspots: [{ id: 'h_clock', at: { x: 10, y: 10, w: 20, h: 20 }, label: 'Часы на стене: 21:30' }],
        overlay: { timestamp: '21:30', channel: 'CCTV-3' },
        artifacts: [{ id: 'a_clock', type: 'clock_conflict', tell: 'Время на часах не бьётся с показанием.' }],
      },
    },
  ],
  records: [
    {
      id: 'r_report',
      kind: 'report',
      title: 'Рапорт о происшествии',
      source: 'Дежурный, 12.06',
      body: [
        { text: 'В ' },
        { entityId: 't_2200', text: '22:00' },
        { text: ' сработала тревога в ' },
        { entityId: 'p_office', text: 'офисе' },
        { text: '. Фигуранты: ' },
        { entityId: 's_eron', text: 'Эрон' },
        { text: ' и ' },
        { entityId: 's_mara', text: 'Мара' },
        { text: '. Есть ' },
        { entityId: 'ev_cctv', text: 'запись CCTV' },
        { text: '.' },
      ],
      mentions: ['t_2200', 'p_office', 's_eron', 's_mara', 'ev_cctv'],
    },
    {
      id: 'r_eron',
      kind: 'transcript',
      title: 'Допрос Эрона',
      source: 'Каб. 4, 12.06',
      body: [
        { entityId: 's_eron', text: 'Эрон' },
        { text: ': «Я был дома в ' },
        { entityId: 't_2200', text: '22:00' },
        { text: ', в ' },
        { entityId: 'p_office', text: 'офис' },
        { text: ' не заходил».' },
      ],
      mentions: ['s_eron', 't_2200', 'p_office'],
    },
    {
      id: 'r_cctv_photo',
      kind: 'photo',
      title: 'Кадр CCTV у входа',
      source: 'Канал CCTV-3',
      mediaId: 'm_cctv',
      metadata: { time: '21:30', geo: 'office', device: 'CCTV-3' },
      body: [
        { text: 'Кадр ' },
        { entityId: 'ev_cctv', text: 'CCTV' },
        { text: ' у ' },
        { entityId: 'p_office', text: 'офиса' },
        { text: ' в ' },
        { entityId: 't_2130', text: '21:30' },
        { text: '. Выгрузку подтвердила ' },
        { entityId: 's_admin', text: 'Кат' },
        { text: '.' },
      ],
      mentions: ['ev_cctv', 'p_office', 't_2130', 's_admin'],
    },
    {
      id: 'r_chat_admin',
      kind: 'chat',
      title: 'Переписка с администратором',
      source: 'Мессенджер',
      grantsKeys: ['k_archive'],
      body: [
        { entityId: 's_admin', text: 'Кат' },
        { text: ': «Журнал по ' },
        { entityId: 'o_card', text: 'карте' },
        { text: ' в закрытом архиве, держи доступ».' },
      ],
      mentions: ['s_admin', 'o_card'],
    },
    {
      id: 'r_access_log',
      kind: 'log',
      title: 'Журнал доступа СКУД',
      source: 'Контроллер двери',
      metadata: { time: '21:28', device: 'door-reader' },
      seal: { keyId: 'k_archive', hint: 'Закрытый архив — нужен доступ от администратора.' },
      body: [
        { text: 'В ' },
        { entityId: 't_2128', text: '21:28' },
        { text: ' ' },
        { entityId: 'o_card', text: 'карта Эрона' },
        { text: ' открыла дверь ' },
        { entityId: 'p_office', text: 'офиса' },
        { text: '.' },
      ],
      mentions: ['t_2128', 'o_card', 'p_office', 's_eron'],
    },
  ],
  contradictions: [
    {
      id: 'c_time',
      between: [
        { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
        { kind: 'metadata', recordId: 'r_access_log', field: 'time' },
      ],
      rule: 'time_overlap',
      weight: 3,
      revealHint: 'Дома в 22:00 — но карта открыла офис в 21:28.',
    },
    {
      id: 'c_photo',
      between: [
        { kind: 'recordClaim', recordId: 'r_eron', claimId: 'home' },
        { kind: 'metadata', recordId: 'r_cctv_photo', field: 'time' },
      ],
      rule: 'time_overlap',
      weight: 1,
    },
  ],
  endings: [
    {
      id: 'end_truth',
      title: 'Истина установлена',
      requires: { all: [{ accuse: 's_eron' }, { decisiveLie: 'c_time' }] },
      quality: 'truth',
      epilogue: ['Эрон сломался под тяжестью журнала доступа.'],
      campaignFlags: ['eron_jailed'],
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
