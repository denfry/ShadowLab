# Зеркальная Ложа — Этап 1 (вертикальный 3D-срез) дизайн

- **Дата:** 2026-06-23
- **Статус:** дизайн утверждён, готов к плану реализации
- **Область:** изолированный dev-харнесс с вертикальным 3D-срезом на React Three
  Fiber поверх движка Этапа 0. Рендерит все три архетипа со стороны замка,
  клик-интеракция через настоящий `applyEvent`, локальное решение до `escaped`.
  Без сети, без таймера свечей, без регистрации в каталоге портала.
- **Зависит от:** Этап 0 — чистый движок `src/games/lodge/engine/` (PR #7,
  ветка `feat/zerkalnaya-lozha-stage0-engine`). Этот этап стэкнут на неё.
- **Родительская спека:** `2026-06-23-zerkalnaya-lozha-design.md` (Секция 5,
  «Этап 1 — вертикальный срез»).

---

## 0. Контекст и решения

Движок Этапа 0 даёт чистый API: `createRun(seed, config) → Run`,
`initRunState(run) → RunState`, `applyEvent(state, lodgeEvent) → RunState`,
реестр `ARCHETYPES` с `solutionEvents`, и `RoomView`-юнион (что показывать
игроку для каждого архетипа). Портал монтирует игры через `GameModule`/
`GameRegistry`; стек — React 18 + Vite 5 + Zustand + Tailwind; 2D-игры рендерятся
на Phaser, который лениво грузится отдельным чанком.

Решения брейншторма (2026-06-23):

- **Запуск — изолированный dev-харнесс.** Dev-роут `/dev/lodge` (только при
  `import.meta.env.DEV`, ленивая загрузка), монтирующий харнесс. Union `GameId`
  и каталог портала НЕ трогаем — регистрация остаётся Этапом 3.
- **Модель «одной роли».** Локальный одиночный срез: **сторона-замок рендерится
  в 3D (интерактивный механизм), сторона-подсказка — в дебаг-панели** (read-only
  `RoomView` партнёра). 3D-комнаты подсказки — Этап 2/3.
- **Все три архетипа** рендерятся (dial / constellation / candle) на generic-
  архитектуре (реестр станций по `RoomView.kind`).
- **Сцена:** одна свечная комната с тремя станциями-замками; клик по станции
  наводит камеру (фокус/орбита, не WASD).
- **Визуал:** примитивы low-poly + `<Text>`-глифы, без ассет-пайплайна.

## Дизайн-столпы

1. **Движок — источник истины.** UI ничего не вычисляет про правила: читает
   `RunState`, шлёт `PuzzleEvent` через `applyEvent`. Никакой дубль-логики.
2. **Шов под сеть.** Между UI и движком стоит Zustand-стор; Этап 2 заменит его
   локальный источник событий на сетевой, не трогая сцену.
3. **Generic по архетипам.** Станции — реестр по `RoomView.kind`, зеркалящий
   реестр архетипов движка. Новый архетип/роль = новая запись.
4. **Тестируем швы, не WebGL.** Нетривиальная логика живёт в сторе и чистых
   адаптерах (`RoomView+state → render-props`) — их и покрываем vitest; сцену
   проверяем одним Playwright-smoke.
5. **Изоляция.** Этап 1 не меняет публичные типы портала и удаляется одним
   роутом + папкой.

---

## Секция 1 — Модель среза и определение «готово»

Срез — локальный одиночный харнесс. Для каждого пазла рисуем в 3D **сторону
замка** (`views[lockOwner]`, интерактивный механизм), а **сторону подсказки**
(`views[clueOwner]`) показываем как read-only данные в дебаг-панели. Так всегда
есть, что оперировать: читаешь подсказку → крутишь 3D-замок → пазл решается.

«Готово» для среза:

1. `/dev/lodge` (в dev-сборке) открывается, рендерится 3D-сцена с тремя
   станциями (dial, constellation, candle).
2. Дебаг-панель: ввод seed + выбор сложности → `regenerate`; по каждому пазлу
   показывает clue-view (read-only) и текущее состояние.
3. Клик по 3D-объектам станции решает пазл руками; события идут через
   `applyEvent`; станция визуально обновляется и помечается решённой.
4. Когда решены все три — баннер «escaped» (из `RunState.escaped`).
5. Кнопка «auto-solve» (гонит `solutionEvents` пазла через стор) — для быстрой
   проверки цикла.

---

## Секция 2 — Архитектура

**Зависимости (новое для Этапа 1):** `three`, `@react-three/fiber` (v8,
совместим с React 18), `@react-three/drei`. В `vite.config.ts` добавляем
`three`-manualChunk (как существующий `phaser`), чтобы 3D грузилось лениво только
на dev-роуте. Точные совместимые версии фиксируются в плане.

**Мост состояния — `useLodgeStore` (Zustand)** `src/games/lodge/ui/store/`:
- Состояние `{ runState: RunState, seed: number, difficulty: Difficulty, seq: number }`.
- `regenerate(seed, difficulty)` → `initRunState(createRun(seed, { difficulty }))`,
  сбрасывает `seq`.
- `dispatch(puzzleId, by, event)` → оборачивает `applyEvent` с инкрементом `seq`.
- `autoSolve(puzzleId)` → берёт `ARCHETYPES[archetypeId].solutionEvents` живого
  инстанса и гонит их через `dispatch`.
- Этот стор — шов: Этап 2 заменит локальный источник событий на сетевой.

**Сцена + реестр станций** `src/games/lodge/ui/scene/`:
- `LodgeScene.tsx` — `<Canvas>`, свечной свет (ambient + тёплые point-lights),
  примитивная комната, три слота-станции, фокус камеры на выбранную станцию
  (tween orbit-target / управляемая камера).
- `stations/registry.ts` — `stationFor(kind): ComponentType` по lock-side
  `RoomView.kind`: `dial→DialStation`, `constellation→ConstellationStation`,
  `candelabra→CandelabraStation`.
- `stations/DialStation.tsx` — диск с глифами `ring` + стрелка; стрелки/клик
  крутят `pos`, рычаг-commit добавляет, рычаг-clear сбрасывает →
  `dial.set`/`dial.commit`/`dial.clear`.
- `stations/ConstellationStation.tsx` — `nodes` звёзд по кругу; клик по двум
  узлам тогглит ребро (линия) → `constellation.toggle`.
- `stations/CandelabraStation.tsx` — ряд из `count` свечей; клик зажигает
  (`candle.light`), рычаг-reset (`candle.reset`).
- Каждая станция берёт `{ puzzle, dispatch }`, читает `views[lockOwner]` +
  `state`, мапит указательные события в `PuzzleEvent`.

**Чистый слой-адаптер (юнит-тестируемый)** `src/games/lodge/ui/adapters/`:
- Чистые функции `RoomView + PuzzleState → render-props`: угол стрелки диска из
  `pos`/длины `ring`; флаги зажжённых свечей из `state.lit`; отрезки рёбер из
  `state.edges` + позиции узлов по кругу. Без R3F. Здесь вся нетривиальная
  UI-логика.

**HUD + дебаг-панель (React + Tailwind поверх канваса):**
- `ui/hud/LodgeHud.tsx` — цель, solved-count, баннер «escaped», плейсхолдеры
  «LOCAL» (связь) и таймера свечей.
- `dev/DevPanel.tsx` — seed-инпут + селект сложности + regenerate; по каждому
  пазлу read-only clue-view и состояние; селектор станции; auto-solve; reset.
- `dev/LodgeDevHarness.tsx` — композит: `<Canvas>`-сцена + HUD + DevPanel,
  владеет стором.
- Dev-роут `/dev/lodge` в роутере приложения, под `import.meta.env.DEV`, лениво.

**Обработка ошибок:** битый/пустой seed → случайный (через существующий
`randomSeed`/`Math`-free helper движка, либо ввод числа); `dispatch` по
решённому/неизвестному пазлу уже no-op в движке; неизвестный `RoomView.kind` в
реестре → плейсхолдер-меш + `console.warn`.

**Файлы** `src/games/lodge/`:
- `ui/store/useLodgeStore.ts`
- `ui/adapters/dial.ts`, `ui/adapters/constellation.ts`, `ui/adapters/candle.ts`
- `ui/scene/LodgeScene.tsx`
- `ui/scene/stations/registry.ts`,
  `ui/scene/stations/{DialStation,ConstellationStation,CandelabraStation}.tsx`
- `ui/hud/LodgeHud.tsx`
- `dev/DevPanel.tsx`, `dev/LodgeDevHarness.tsx`
- роут-вставка (DEV-guarded) в роутере приложения
- `vite.config.ts` — `three`-manualChunk

---

## Секция 3 — Тестирование

- **Vitest (стор):** `regenerate` даёт валидный `RunState` (через `validateRun`);
  `dispatch` двигает `seq` и состояние пазла; `autoSolve` доводит run до
  `escaped`.
- **Vitest (адаптеры):** угол диска для известных `pos`/`ring`; флаги свечей для
  `lit`; отрезки/позиции узлов для `edges`. Чистые функции, без WebGL.
- **Playwright smoke (один)** через webapp-testing: открыть `/dev/lodge`,
  дождаться канваса, нажать auto-solve по всем пазлам, проверить баннер
  «escaped». WebGL-нутро R3F не юнит-тестим — логика в сторе/адаптерах.

---

## Секция 4 — Вне Этапа 1 (зафиксировано осознанно)

- Сеть / Supabase Realtime, лобби, presence, реконнект (Этап 2).
- 3D-комнаты со стороны подсказки (read-only; Этап 2/3).
- Реальный таймер свечей, голос/пинги (Этап 3).
- Финальный арт/ассеты — пока примитивы (Этап 3).
- Регистрация в каталоге портала, изменения union `GameId`/`GameTheme`,
  сейвы (Этап 3).
- Свободное перемещение/аватары (используем фокус камеры, не локомоцию).

---

## Секция 5 — Риски и заметки

- **Совместимость R3F.** `@react-three/fiber` v8 — под React 18; `@react-three/
  drei` — совместимый мажор. Точный набор версий проверяется и пиннится в плане
  перед установкой.
- **Ленивая загрузка.** Сцена и R3F попадают только в dev-роут и в `three`-чанк;
  основной бандл портала не растёт (проверяемо в плане).
- **Шов под Этап 2.** Сигнатура `dispatch(puzzleId, by, event)` намеренно
  совпадает с формой `LodgeEvent`, чтобы сетевой слой Этапа 2 встал на тот же
  стор без переписывания сцены.
