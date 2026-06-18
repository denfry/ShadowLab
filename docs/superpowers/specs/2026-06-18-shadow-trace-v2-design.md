# Shadow Trace v2 — дизайн расширенного детективного движка

- **Дата:** 2026-06-18
- **Статус:** дизайн утверждён, готов к плану реализации
- **Область:** переделка игры `src/games/shadow-trace` в content-driven движок
  ветвящихся, длинных, медиа-насыщенных дел + сквозная кампания.
  Новые игры портала — бонус-раздел (Секция 7), отдельные спеки позже.

---

## 0. Контекст и цели

Сейчас Shadow Trace — линейный движок: фазы `intro → investigate → questions →
accuse → result`, плоский список улик/подозреваемых, одно «правильное» решение
(`solution.culpritId`). Дело задаётся одним JSON (`public/data/cases/*.json`).

**Цель:** сделать дело «очень сложным и долгим», с реальным ветвлением и медиа.
По итогам брейншторма выбрано (всё сразу):

- **Ветвление:** несколько развязок + разные пути расследования + выборы с
  последствиями + кампания из связанных эпизодов.
- **Медиа:** интерактивные улики (зум/перемотка) + нарративные вставки +
  перекрёстный анализ метаданных + поддельные фото/видео.
- **Сложность через:** противоречия и ложь + ложные следы + глубину/объём.
  **Без** таймеров и лимитов попыток — «честная» сложность через синтез.
- **Ассеты:** стилизованные/процедурные (векторные сцены), не растровые файлы.

Архитектурный подход — **C («Граф + дедукция + кампания»), реализуемый
поэтапно**: четыре независимых подсистемы, играбельный вертикальный срез на
Этапе 1.

## Дизайн-столпы

1. **«Честная» сложность.** Дело всегда решаемо из улик. Трудность — в синтезе
   десятков фактов, не в удаче.
2. **Сначала противоречие.** Главный глагол — «поймать на лжи»: сопоставил
   показание, время на фото и лог → нашёл нестыковку.
3. **Ветвление, которое значит.** Прочтение улик меняет, кого обвинить; движок
   принимает несколько защитимых, но разных выводов — разные концовки и оценка.
4. **Медиа = улика, не декор.** Фото/видео нужно изучать; часть — подделки.
5. **Кампания с памятью.** Сквозное досье и флаги: выбор в эпизоде 1 аукается
   в эпизоде 3.

---

## Секция 1 — Опыт игрока: рабочий стол детектива

Линейные фазы заменяет «стол следователя» с вкладками:

- **Досье** — блокнот фактов (автозаписи + ручные заметки), фильтры по
  персонажам/времени.
- **Хранилище улик** — всё собранное + «инспектор» для глубокого изучения.
- **Карта зацепок** — визуализация графа расследования: открытое / закрытое /
  отработанное.
- **Доска связей** — расширенная: линкует утверждения и подсвечивает
  противоречия.
- **Показания** — допросы/заявления, помеченные временем и местом.
- **Стол обвинения** — собрать теорию: кто + как + какая улика поддельная +
  мотив.

**Петля расследования:**

```
Отработать зацепку → улики/медиа/показания
  → изучить медиа (хотспот / перемотка / метаданные)
  → занести факты в досье
  → сопоставить → найти противоречие
  → противоречие открывает новые зацепки / давит на подозреваемого
  → сузить круг → выдвинуть обвинение
  → концовка по накопленным флагам + точности
```

Нет жёсткого «коридора» фаз: игрок сам решает порядок зацепок, граф открывается
по мере находок.

---

## Секция 2 — Анатомия дела и формат данных

Дело — один JSON в `public/data/cases/*.json` (+ медиа-описания). Восемь
сущностей по четырём подсистемам. Логика «что открыто / какая концовка» — это
**условия (`Condition`) над состоянием**, движок не знает сюжета.

```ts
interface CaseV2 {
  id: string;
  title: string;
  difficulty: 'normal' | 'hard' | 'nightmare';
  synopsis: string;
  episodeOf?: string;           // id кампании, если часть сквозного сюжета
  startNodeIds: string[];       // зацепки, открытые изначально
  nodes: LeadNode[];            // граф расследования
  suspects: Suspect[];
  evidence: Evidence[];         // пул улик (медиа + документы + объекты)
  statements: Statement[];      // показания = проверяемые факты
  contradictions: Contradiction[];
  endings: Ending[];            // правила развязок
  flagsSchema: FlagDef[];       // какие флаги существуют (для редактора/валидации)
}

interface LeadNode {
  id: string;
  type: 'location' | 'interrogation' | 'analysis' | 'cutscene';
  title: string;
  requires?: Condition;         // условие открытия
  body: string[];               // нарратив сцены
  choices?: Choice[];           // выборы с последствиями
  grants?: Grant[];             // что даёт: улики, показания, флаги, узлы
  oneShot?: boolean;
}
interface Choice { id: string; label: string; requires?: Condition; effects: Effect[]; }

interface Evidence {
  id: string; title: string;
  kind: 'message' | 'log' | 'document' | 'photo' | 'video' | 'object';
  summary: string; content?: string;
  media?: MediaSpec;            // если photo/video — процедурная сцена (Секция 3)
  metadata?: { time?: string; geo?: string; device?: string; exif?: Record<string, string> };
  relatedSuspectIds: string[];
  authenticity: 'real' | 'fake';
  revealsStatementIds?: string[];
}

interface Statement {
  id: string; speakerId: string;
  claim: string;                // «Я был дома в 22:00»
  asserts: { subjectId: string; place?: string; timeStart?: string; timeEnd?: string; action?: string };
}

interface Contradiction {
  id: string;
  between: [FactRef, FactRef];
  rule: 'time_overlap' | 'place_conflict' | 'mutual_exclusive' | 'authenticity';
  unlocks?: Grant[];
  weight: number;
}

interface Suspect {
  id: string; name: string; role: string; alibi: string; motive?: string;
  truthProfile: { wasAt?: string; at?: string; didAction?: string }; // игроку не видно
}

interface Ending {
  id: string; title: string;
  requires: Condition;
  quality: 'truth' | 'partial' | 'miscarriage' | 'cold_case';
  epilogue: string[];
  campaignEffects?: Effect[];
}

type Condition =
  | { hasEvidence: string } | { hasFlag: string }
  | { foundContradiction: string } | { accuse: string }
  | { all: Condition[] } | { any: Condition[] } | { not: Condition };

type Effect = {
  setFlag?: string; addNode?: string; lockNode?: string;
  addEvidence?: string; addStatement?: string;
};
type Grant = Effect;
type FactRef = { type: 'statement' | 'evidence' | 'metadata'; refId: string };
```

**Состояние прохождения** (`CaseProgress`): `discoveredEvidence[]`, `openNodes[]`,
`flags{}`, `notes[]`, `foundContradictions[]`, `choicesMade{}`, `dossierLinks[]`.

Ключевые решения: **противоречие — первоклассная сущность** (не просто «фейковая
улика»); **развязки заданы условиями**, не фиксированным `culpritId`.

---

## Секция 3 — Процедурные фото и видео

Никаких реальных видеофайлов. «Фото»/«видео» — данные-сцены, рисуемые слоями
(SVG + CSS) с CCTV/полароид-эстетикой. Зум, перемотка, метаданные и подделки —
«бесплатно», вес в килобайтах.

```ts
interface MediaSpec {
  kind: 'photo' | 'video';
  aspect: '4:3' | '16:9' | '1:1';
  style: 'cctv' | 'phone' | 'polaroid' | 'doc-scan' | 'thermal';
  layers: SceneLayer[];
  hotspots: Hotspot[];
  frames?: VideoFrame[];         // только video
  overlay?: { timestamp?: string; channel?: string; battery?: number; geostamp?: string };
  artifacts?: Artifact[];        // следы подделки, если authenticity:'fake'
}

interface SceneLayer {
  id: string; z: number;
  shape: 'rect' | 'figure' | 'object' | 'text' | 'shadow' | 'reflection' | 'sprite';
  at: { x: number; y: number; w: number; h: number };  // координаты в % сцены
  sprite?: string;               // ключ из библиотеки векторных силуэтов
  tint?: string; rotation?: number; opacity?: number;
  props?: Record<string, unknown>;   // напр. { clock: "22:14" }
}

interface Hotspot {
  id: string; at: { x: number; y: number; w: number; h: number };
  label: string;
  revealRequires?: Condition;
  grants?: Grant[];
}

interface VideoFrame { t: number; changes: Partial<SceneLayer>[]; hotspots?: Hotspot[]; }

interface Artifact {
  id: string;
  type: 'clone' | 'shadow_mismatch' | 'impossible_reflection' | 'clock_conflict'
      | 'timestamp_metadata_mismatch' | 'splice_seam' | 'lighting_inconsistency';
  at?: { x: number; y: number; w: number; h: number };
  tell: string;
  detectRequires?: Condition;
  grants?: Grant[];
}
```

- **Библиотека `sprite`** — заранее нарисованные плоские векторные силуэты (люди,
  предметы, мебель, техника), комбинируются. Один набор на все дела.
- **Инспектор улики:** зум/пан, кнопка «Enhance» (ступенчато раскрывает деталь
  хотспота). Изучение хотспота → «факт» в досье + опционально `Grant`.
- **Видео = скрабируемая раскадровка:** каждый `VideoFrame` — состояние сцены на
  отметке времени; ползунок, кросс-фейд между кадрами, тикающий таймштамп.
  Загадка «найди момент» = перемотка к нужной секунде.
- **Подделки = артефакты в рендере.** `clock_conflict` и
  `timestamp_metadata_mismatch` напрямую порождают `Contradiction` → медиа
  кормит общий движок дедукции, а не живёт отдельно.
- **Деградация:** `prefers-reduced-motion` → видео как стопка кадров без
  анимации. Битый медиа-спек → улика-документ-заглушка (дело не падает).

---

## Секция 4 — Дедукция: доска, противоречия, обвинение, развязки

```ts
type TimeSpan = { start?: string; end?: string };  // ISO-время, для авто-сверки

interface Fact {
  id: string;
  source: { type: 'evidence' | 'statement' | 'hotspot' | 'metadata'; refId: string };
  text: string;
  subjectIds: string[];
  time?: TimeSpan; place?: string;
  pinned?: boolean;
}

interface Accusation {
  culpritId: string;
  method?: string;
  fakeEvidenceIds: string[];
  motiveId?: string;
  keyContradictionIds: string[];
}

interface DeductionResult {
  rank: 'F' | 'C' | 'B' | 'A' | 'S';
  contradictionsFound: number; contradictionsTotal: number;
  correctLinks: number; falseLinks: number;
  fakesIdentified: number; fakesTotal: number;
  accusationQuality: 'truth' | 'partial' | 'miscarriage' | 'cold_case';
  flagsForCampaign: string[];
}
```

1. **Досье как граф фактов.** Узнанное оседает карточками `Fact` с
   нормализованными `time`/`place` для авто-сверки.
2. **Доска связей v2** связывает факты типами `supports` / `contradicts` /
   `explains`. `contradicts`-связь сверяется с авторскими `Contradiction`:
   попал → противоречие раскрыто (свечение, `unlocks`, очки); мимо → серая
   «гипотеза», **без штрафа**. Часть противоречий движок подсказывает пассивно;
   на `nightmare` авто-подсказок нет.
3. **Стол обвинения** — структурированная теория (4 слота), заполняется только
   открытым. Нельзя опираться на нераскрытое противоречие.
4. **Развязка по условиям:** движок идёт по списку `Ending` сверху вниз и берёт
   первый, чьё `requires` истинно. Несколько «правильных» исходов:
   `truth` / `partial` / `miscarriage` / `cold_case`. Параллельно — `rank` за
   полноту и точность дедукции (можно поймать виновного, но на C).

**Анти-фрустрация:** граф никогда не упирается в тупик (гарантирует валидатор);
застрял → механика «давления» (повторный допрос по найденному противоречию даёт
зацепку); `cold_case`/`miscarriage` — концовки, не game over, дело переоткрывается.

---

## Секция 5 — Ветвление и кампания

```ts
interface Campaign {
  id: string; title: string;
  episodes: EpisodeRef[];
  startEpisodeId: string;
}
interface EpisodeRef {
  id: string; caseId: string;
  requires?: Condition;
  nextOptions: { episodeId: string; requires?: Condition }[];
}

interface CampaignState {
  campaignId: string;
  flags: Record<string, boolean | number | string>;
  reputation: { press: number; police: number; underworld: number };
  ledger: ConsequenceRecord[];
  retainedEvidence: string[];
  knownCharacters: string[];
}
interface ConsequenceRecord {
  episodeId: string;
  type: 'jailed' | 'freed' | 'died' | 'allied' | 'betrayed';
  subjectId: string;
}
```

- **Кампания = граф эпизодов** над общим `CampaignState`; эпизоды соединены
  условиями (исход дела 1 решает, попадёшь ли в 2A или 2B).
- **Перенос:** концовка пишет `campaignEffects` → флаги, репутация, `ledger`,
  `retainedEvidence`. Пример: `miscarriage` → невиновный осуждён → в эпизоде 3
  его как свидетеля больше нет, ветка закрывается.
- **Один `caseId` читается по-разному** в зависимости от `CampaignState`: другие
  `startNodeIds`, альтернативные `Statement`, заранее лежащие `retainedEvidence`.
- **Репутация — мягкое ветвление:** меняет доступность узлов (низкая `police` →
  нет ордера, ищи обход; высокая `underworld` → информатор).
- **Сохранения:** срез `campaign` в сейв-данных поверх существующего
  `SaveManager`/`StorageAdapter`; per-case `CaseProgress` живёт внутри эпизода,
  `CampaignState` — уровнем выше. Версионирование — через `migrations.ts`.
- **Реиграбельность:** концовки/пути — условия, повтор с другими выборами даёт
  реально другой контент.

---

## Секция 6 — Поэтапный план, интеграция, тесты

**Этап 0 — Фундамент (без UI):** типы/схема; вычислитель `Condition`; модель
состояния; матчер противоречий; резолвер концовок; валидатор контента. Юнит-тесты.

**Этап 1 — Вертикальный срез (первая играбельная веха):** одно полное дело
end-to-end; рабочий стол целиком; инспектор медиа только для **фото** (зум,
хотспоты, Enhance); раскрытие противоречий связыванием → несколько концовок. Без
кампании и видео, но это целостная ветвящаяся игра.

**Этап 2 — Глубина медиа:** видео-скрабинг, подделки/артефакты, метаданные и их
сверка с показаниями.

**Этап 3 — Кампания:** `CampaignState`, граф эпизодов, последствия/репутация,
перенос флагов/улик, интеграция с `SaveManager` + миграция схемы.

**Этап 4 — Масштаб контента:** 2–3 эпизода в кампанию, уровни `difficulty`
(вкл. `nightmare`), полировка, достижения.

**Судьба `missing-researcher`:** остаётся на старом пути, пока v2 не доказан на
Этапе 1; затем пересобирается на v2 как обучающее дело либо выводится. v2 живёт
рядом, внешний контракт `GameModule` не меняется.

**Интеграция с порталом:**

- Снаружи — один `GameModule` (`src/types/game-module.ts`), общение через
  `PortalBridge`/`GameContext` как сейчас; меняется только внутренность игры.
- **Достижения** (`AchievementManager`): концовка `truth`, ранг `S`, «вскрыл все
  противоречия», «поймал фейк без подсказки», «прошёл `nightmare`».
- **Настройки** (`useSettingsStore`): выбор сложности, `reduced-motion`.
- **Темы** — через `data-theme`; добавить «нуар»-палитру.
- Ленивая загрузка отдельным чанком, как сейчас.

**Валидатор контента (гарантия «нет тупиков»)** — модуль + тест + CLI на сборке:

- каждое нужное противоречие достижимо (BFS по графу от `startNodeIds`);
- каждый `Ending` достижим; нет «мёртвых» концовок;
- нет узлов-сирот и циклических самоблокирующих `requires`;
- хотспоты в границах сцены, кадры видео отсортированы по `t`, `refId` валидны.
- Падение валидатора = дело не собирается.

**Тесты (vitest, детерминированно, RNG сидируется):**

- юнит: вычислитель `Condition`, матчер противоречий, резолвер концовок, ранг;
- свойство: для каждого дела существует путь к `truth`-концовке (валидатор);
- регресс: детерминизм оценки (фикс-вход → фикс-выход).

---

## Секция 7 — Бонус: концепты новых игр для портала

Короткий брейншторм-список (отдельные спеки позже). Все переиспользуют
инфраструктуру портала (`GameModule`, `PortalBridge`, сейвы, достижения, темы) и
часть — новые подсистемы Shadow Trace v2 (особенно процедурное медиа и движок
условий).

1. **Last Transmission** (React, content-driven) — допрос-расследование в духе
   «видео-архива»: игрок ищет по базе фрагментов «показаний» (раскадровки из
   медиа-движка v2) по ключевым словам, собирая нелинейную историю. **Прямо
   переиспользует** медиа-подсистему и `Condition`. Длинная, реиграбельная.

2. **Coldwire / Станция** (React, content-driven) — дешифровка «перехватов»:
   шифры замены, числовые радиостанции, стеганография в процедурных «фото».
   Логические головоломки нарастающей сложности; кампания из «передач».

3. **Quarantine Protocol** (Phaser, симуляция) — менеджмент-выживание изолятора:
   ресурсы, заражение, мораль. Сосед `Colony Evolution` по жанру, переиспользует
   её систему симуляции/баланса и детерминированный RNG.

4. **Black Market** (React, экономическая стратегия) — трейдинг на теневом рынке:
   цены, риск облавы, репутация (та же модель репутации, что в кампании v2).
   Короткие забеги, сильная реиграбельность, таблицы рекордов под 1.0-роадмап.

5. **Witness** (React, логическая дедукция) — «чистая» логика без медиа:
   сетки-нонограммы из показаний свидетелей, где клетки = «кто где был».
   Дешёвый в контенте, бесконечно генерируемый, хорош для ежедневных челленджей.

6. **Deadline** (React, нарративный рогалик) — процедурный детектив: дело
   собирается из кусочков-узлов v2 случайной раскладкой (сид). Один движок —
   бесконечные дела. Долгая цель после Этапа 4 v2.

Приоритет к проработке (предложение): **Last Transmission** и **Coldwire** —
максимально переиспользуют новый медиа-движок и дают «инвестигативную» связку
жанров вокруг детектива.

---

## Открытые вопросы / решения по умолчанию

- **Объём Этапа 1.** По умолчанию: 1 дело, ~8–12 узлов, ~15–20 улик, ~6
  противоречий, 3–4 концовки. Корректируется при написании плана.
- **Библиотека силуэтов.** Стартовый набор ~30–40 спрайтов покрывает первое
  дело; расширяется по мере контента.
- **Git.** Репозиторий не инициализирован (`Is a git repository: false`) — спек
  не коммитится; при инициализации git добавить в историю.
