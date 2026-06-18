# Denfry Games / ShadowLab Games

Браузерный игровой портал с двумя играми на единой архитектуре. MVP 0.1.

- **Shadow Trace** — детективная головоломка (content-driven, React). Дело «Пропавший исследователь».
- **Colony Evolution** — динамическая стратегия выживания (Phaser, симуляция в реальном времени).

## Стек

Vite · React 18 · TypeScript · TailwindCSS (+ CSS-переменные, темы через `data-theme`) ·
Zustand · Phaser 3 · localStorage (за абстракцией `StorageAdapter`).

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production-сборка в dist/
npm run preview    # предпросмотр сборки
npm run typecheck  # tsc --noEmit
npm test           # vitest (scoring + детерминизм симуляции)
```

## Архитектура (коротко)

Каждая игра — самодостаточный модуль, реализующий контракт `GameModule`
(`src/types/game-module.ts`). Портал общается с игрой только через `PortalBridge`
(`src/services/games/PortalBridge.ts`), который выдаёт `GameContext` (события,
сохранения, достижения, настройки). Игры лениво загружаются отдельными чанками.

```
src/
  app/        — shell, роутер, bootstrap, провайдеры
  pages/      — страницы портала (Home, Games, Launcher, Profile, …)
  ui/         — общие компоненты (primitives, layout, game, feedback, profile)
  stores/     — Zustand (settings, profile, achievements, runtime, toasts)
  services/   — SaveManager, AchievementManager, GameRegistry, PortalBridge, News
  core/       — EventBus, seeded RNG, утилиты, базовые Phaser-утилиты
  games/
    shadow-trace/  — domain · systems (CaseManager, ScoringSystem) · ui · module
    colony/        — domain · systems (simulation) · scenes (Phaser) · ui · module
public/data/  — контент: дела детектива (cases/*.json), новости (news/index.json)
```

Полная проектная архитектура (20 разделов) — в
`~/.claude/plans/senior-game-refactored-scott.md`.

## Дорожная карта

- **0.1** — портал, две игры, localStorage, достижения, настройки. ✅
- **0.2 (сейчас)** — 2-е детективное дело + выбор дел + допросы; дерево технологий,
  +6 событий (рейды), панель жителей; рекорды и переходы; миграция сейвов v1→v2. ✅
- **0.3** — IndexedDB, новые дела, балансировка, ещё технологии/здания.
- **1.0** — Supabase: аккаунты, cloud saves, leaderboards, новости из БД.
- **2.0** — мультиплеер / сезонные события.

## Дисклеймер

Все данные в Shadow Trace полностью вымышлены. Игра — головоломка и **не**
является инструментом для реального взлома, слежки или OSINT по реальным людям.
