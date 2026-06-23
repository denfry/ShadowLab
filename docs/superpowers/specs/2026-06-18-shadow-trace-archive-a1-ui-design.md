# Shadow Trace — Архив-расследование: UI вертикальный срез (Этап A1)

- **Дата:** 2026-06-18
- **Статус:** дизайн утверждён, готов к плану реализации
- **Опирается на:** `2026-06-18-shadow-trace-archive-redesign-design.md` (концепт) и Этап A0 — готовый чистый движок `src/games/shadow-trace/archive/`.
- **Заменяет:** старый план Этапа 1b («стол следователя») и v1-геймплей Shadow Trace.

---

## 1. Цель и объём

Сделать **играбельный вертикальный срез** архивного расследования: терминал архива (Индекс / Читалка / Досье), процедурный рендер прикреплённого медиа, поток обвинения и экран концовки — на одном авторском деле. Подключить как игру `shadow-trace` в портал.

Срез строится **двумя планами под этим спеком**:
- **A1a — ядро терминала** (играбельно целиком; медиа = плейсхолдер).
- **A1b — медиа-рендерер** (`MediaSpec`→React/SVG, впаян в читалку).

Движок A0 не меняется (кроме одного нового read-only селектора `getSelectableFacts`). Старый v1-геймплей выводится из эксплуатации.

## 2. Архитектура и монтаж

Игры портала реализуют интерфейс `GameModule` (`src/types/game-module.ts`): `definition`, `payloadVersion`, `mount(container, ctx)`, опц. `Hud`. Для чистых React-игр `mount()` — no-op, весь UI в `Hud` (как у текущего shadow-trace и colony).

- **`ShadowTraceGameModule.tsx`** (переписываем): `mount` — no-op; `Hud: ({ ctx }) => <ArchiveGame ctx={ctx} />`; `payloadVersion` поднимаем (формат сейва меняется на `ArchiveProgress`).
- **`ArchiveGame`** (оркестратор, новый файл в `src/games/shadow-trace/archive-ui/`):
  - `usePageTheme('shadow')` (нуар-тема: кримсон/виолет).
  - Грузит дело через `ArchiveCaseManager.load(caseId)` (caseId из `ctx`/params; дефолт — дело-пример).
  - Восстанавливает прогресс: `ctx.save.load(slot)` → если payload валиден как `ArchiveProgress` того же `caseId`, иначе `createArchiveProgress(caseData)`.
  - Держит состояние через `useArchiveGame`; рендерит `ArchiveTerminal` + `AccusationModal` + `EndingScreen`.
- **`useArchiveGame(caseData, initial, ctx)`** (хук): `useReducer` над `ArchiveProgress`. Экшены вызывают чистые переходы A0: `openRecord` / `grantKey` / `pinRecord` / `unpinRecord` / `pinEntity` / `unpinEntity` / `markSuspicion` / `clearSuspicion` / `addNote` / `accuse`. После каждой мутации — `ctx.save.autosave(payload)`. Отдаёт мемоизированные селекторы (`getRecordView`/`getEntityPage`/`getDiscoveredIndex`/`getCaseFile`/`getAccusableSuspects`/`getSelectableFacts`) и `checkAccusation`.
- **`ArchiveCaseManager`** (новый, `src/games/shadow-trace/archive-ui/ArchiveCaseManager.ts`): `load(caseId)` → `fetch('/data/archive-cases/<caseId>.json')`, кэш в памяти, прогон `validateArchiveCase` (в dev — `console.error` + бросить, если `!ok`; в prod — залогировать). Возвращает `CaseArchive`.
- **Регистрация:** в `src/games/index.ts` загрузка `shadow-trace` указывает на новый модуль (id `'shadow-trace'` сохраняется; `GameId`-юнион не меняется).

## 3. Экран и компоненты

Корень — оверлей `absolute inset-0 z-10 overflow-hidden` под нуар-темой (как `ShadowTraceGame`). Шапка: название дела + кнопка «Заключение». Тело: `grid md:grid-cols-[260px_1fr_300px]`, на узких экранах — переключаемые вкладки (Индекс/Читалка/Досье).

Дерево компонентов (`src/games/shadow-trace/archive-ui/components/`):
- **`ArchiveTerminal`** — лейаут-оболочка (шапка + 3 панели; на мобиле — табы).
- **`IndexPane`** — `getDiscoveredIndex`: сущности по типам (сворачиваемые группы, метка типа + счётчик записей) + список открытых записей. Клик по сущности → открыть карточку сущности; по записи → открыть запись.
- **`ReaderPane`** — показывает текущий вид + хлебные крошки/«назад». Локальное эфемерное UI-состояние навигации (НЕ часть `ArchiveProgress`): `view: { kind:'record'; id } | { kind:'entity'; id } | null` + стек истории.
  - **`RecordView`** — `getRecordView(recordId)`: заголовок/источник/время; тело — `body`-спаны, где entity-спан рендерится как `EntityLink` (кнопка), текстовый — как текст; блок метаданных (`metadata`); прикреплённое медиа (A1a — `MediaPlaceholder`; A1b — `MediaRenderer`); кнопки **pin** и **«подозрительно»** (+опц. заметка). Если `sealed` — карточка с замком и `sealHint`, тело/медиа скрыты.
  - **`EntityCard`** — `getEntityPage(entityId)`: метка/тип/`summary`; список записей о сущности (запечатанные — с иконкой замка, клик ведёт к sealed-`RecordView`); связанные сущности (кликабельные `EntityLink`); кнопка **pin**.
  - **`EntityLink`** — инлайновая кнопка-сущность; клик → навигация на карточку сущности.
- **`CaseFilePane`** — `getCaseFile`: закреплённые записи и сущности (клик → навигация), подозрения (запись + заметка, клик → навигация), список заметок + поле ввода заметки. Кнопка **«Заключение»** (активна всегда; обвинение можно выдвинуть в любой момент).
- **`AccusationModal`** — см. §4.
- **`EndingScreen`** — см. §4.

**Связь навигации и движка:** клик по записи (в индексе, в карточке сущности, в досье) = диспатч `openRecord(recordId)` (раскрывает сущности, может снять печать) **и** установка `view` на эту запись. Клик по сущности = только смена `view` (сущность уже открыта, раз кликабельна; движок не мутируем). «Назад» снимает верх стека истории.

## 4. Потоки: нитка, печати, обвинение, концовка

**Идти по нитке.** Открыл запись → её сущности раскрылись → они дают новые достижимые записи → открываешь их → глубже. «Назад» возвращает по истории.

**Снятие печати.** Запечатанная запись = карточка с замком + `sealHint`. Ключ приходит из: чтения записи-источника (`openRecord` применяет `grantsKeys`) или клика по медиа-хотспоту (`grantKey`, этап A1b). Движок пересчитывает `openRecords` → запись становится читаемой; UI перерисовывает индекс/карточку.

**Досье.** `pin`/«подозрительно» в `RecordView`/`EntityCard` → отражается в `CaseFilePane`. Закреплённое лежит рядом для сопоставления глазами (заменяет «доску»).

**Обвинение — модель «фактов».** Решающая ложь движка — пара `FactRef`. В A1 берём гранулярность **«запись + её метаданные»** (тип `recordClaim` в A1 не используется, но остаётся в движке для будущих дел):
- Новый чистый селектор **`getSelectableFacts(caseData, record): { ref: FactRef; label: string }[]`** (в `archive/selectors.ts`, барель дополняется): для записи отдаёт `{ kind:'record', recordId }` («вся запись: <title>») и по одному `{ kind:'metadata', recordId, field }` на каждое присутствующее поле `metadata` (time/geo/device) с человекочитаемой подписью.
- **`AccusationModal`**: выбор **виновного** (селект из `getAccusableSuspects`) + выбор **двух** фактов решающей лжи из фактов всех **закреплённых** записей (объединение `getSelectableFacts` по `pinnedRecords`). Кнопка «Предъявить» активна при выбранном виновном (ложь опциональна — без неё возможна `partial`/`truth`-без-decisive по правилам дела).
- Сабмит → `accuse({ culpritEntityId, decisiveLie })` → `EndingScreen`.
- **Дело-пример** авторизует решающее противоречие на этой гранулярности: показание Эрона `{ kind:'record', recordId:'r_eron' }` ↔ метаданные журнала `{ kind:'metadata', recordId:'r_access_log', field:'time' }`.

**Концовка.** `checkAccusation` → `EndingScreen`: заголовок концовки + `epilogue`, ранг F–S и разбор `DeductionResultArchive` (найдена ли решающая ложь, замечено противоречий N/M, печатей вскрыто, штрафы). Запись результата: `ctx.achievements.unlock(...)` (напр. «дело раскрыто», «ранг S») и `ctx.records.submit(...)` (ранг/очки) по образцу старого `ShadowTraceGame`. Кнопки: «В портал» / «Заново».

## 5. MediaRenderer (этап A1b)

`MediaSpec` (archive, фото-онли): `aspect`, `style`, `layers[]`, `hotspots[]`, `overlay?`, `artifacts?`.

- **`<MediaRenderer spec={MediaSpec} onHotspot={(hotspotId, grantsKeys) => void} />`** — чистый презентационный компонент (`src/games/shadow-trace/archive-ui/media/MediaRenderer.tsx`).
- Рамка по `aspect` (4:3/16:9/1:1); оформление по `style`: `cctv` (зеленоватый, сканлайны, уголки, HUD), `polaroid` (белая рамка), `phone`/`doc-scan`/`thermal` — свои CSS-трактовки.
- `layers` (сорт по `z`) → SVG в `viewBox 0 0 100 100`, позиции по `Rect`-процентам: `rect`→`<rect>`, `figure`→силуэт (скруглённый прямоугольник/эллипс), `object`→`<rect>`/спрайт-заглушка, `text`→`<text>`, `shadow`/`reflection`→полупрозрачные градиенты. Цвет из `tint`/токенов; `opacity`/`rotation` применяются.
- `overlay` → CCTV-HUD моно-шрифтом по углам (timestamp/channel/battery/geostamp).
- `hotspots` → прозрачные кликабельные зоны по `Rect`; клик → раскрыть `label` (callout) + вызвать `onHotspot(id, grantsKeys)`. Reader привязывает `onHotspot` к `grantKey`. Аффорданс «Enhance».
- `artifacts` → callout-«улика подделки» (если есть). Гейтинг-детект отложен (в archive-медиа нет `detectRequires`).
- Zoom — простой тумблер-увеличение (scale), без полноценного pan (YAGNI).
- **A1a-плейсхолдер** (`MediaPlaceholder`): рамка по `style` + `overlay`-метаданные текстом + подписи хотспотов списком (кликабельны, дёргают `grantKey`). A1b заменяет на `MediaRenderer`.

## 6. Данные и персистентность

- **Дело:** `public/data/archive-cases/<id>.json` — дело Эрон/Мара как `CaseArchive` (порт TS-фикстуры `tests/fixtures/sample-archive-case.ts`; в A1b в `media` добавляются слои CCTV-кадра, чтобы рендеру было что рисовать). Решающее противоречие — на гранулярности record/metadata (см. §4).
- **Загрузка:** `ArchiveCaseManager.load` валидирует через `validateArchiveCase`; при `!ok` в dev — бросает с перечнем issues.
- **Сейв:** payload `{ caseId, progress: ArchiveProgress }`; `payloadVersion` поднят. Автосейв на каждую мутацию. Рестор: при несовпадении `caseId`/формата — новый прогресс.

## 7. Объём по этапам

- **A1a (план 1):** типы UI-навигации; `useArchiveGame`; `ArchiveCaseManager`; JSON-дело (текст+метаданные, медиа-плейсхолдер); `ArchiveTerminal` + `IndexPane` + `ReaderPane`(`RecordView`/`EntityCard`/`EntityLink`) + `CaseFilePane`; `AccusationModal` + `EndingScreen`; селектор `getSelectableFacts` (+тест); `ShadowTraceGameModule` переписан + регистрация; вывод v1 из эксплуатации. **Результат:** дело проходится от начала до концовки в приложении.
- **A1b (план 2):** `MediaRenderer` (слои/хотспоты/overlay/artifacts) + замена `MediaPlaceholder` в `RecordView`; CCTV-слои в JSON-деле; хотспот→`grantKey`.

## 8. Тесты и верификация

- **Чистая логика** (`getSelectableFacts`, любые чистые навигационные/вью-хелперы) — юнит-тесты vitest (как A0). Движок A0 уже покрыт — не перетестируем.
- **React-компоненты** — нет jsdom/RTL-окружения; верификация **запуском приложения**: `npm run dev`, пройти дело (открыть нитку → снять печать → обвинить → концовка S), скриншоты ключевых экранов. Планы включают явные шаги запуска/проверки.
- **Гейт сборки:** `npm run typecheck` чисто; `npm run build` проходит.

## 9. Снос старого кода

После рабочего и проверенного **A1a**:
- удалить `src/games/shadow-trace/ui/` (ConnectionBoard, FakeTerminal, ShadowTraceGame и пр.), `src/games/shadow-trace/systems/CaseManager.ts` + `ScoringSystem.ts`, `src/games/shadow-trace/domain/`, старый `src/games/shadow-trace/engine/`, старые `public/data/cases/*`;
- оставить `src/games/shadow-trace/archive/` (движок A0), `archive-ui/` (новый UI), `definition.ts`, `ShadowTraceGameModule.tsx`.
- `GameId` остаётся `'shadow-trace'`.

## 10. Принципы (YAGNI / отложено)

- Гранулярность обвинения = record/metadata; `recordClaim`-атомы и «доска» — не делаем.
- Медиа: фото-онли; видео/скраббинг — A2.
- Без свободного полнотекстового поиска; навигация только по сущностям-ссылкам + индекс открытого.
- Кампания (`episodeOf`, перенос флагов/репутации) — A2.
- Пан/полный зум фото, прогрессивный детект артефактов — отложены.
