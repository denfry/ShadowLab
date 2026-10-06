# ShadowLab Games

A browser game portal that hosts several games on one shared architecture: a detective puzzle, a colony survival simulation and a two-player co-op escape room. Also published as "Denfry Games".

The games and the portal UI are in Russian. All Shadow Trace case data is fictional.

## Games

| Game | Genre | Tech |
|------|-------|------|
| **Shadow Trace** | Detective puzzle: study evidence, documents and logs, link them on a board, find who is behind a disappearance. One piece of evidence is fake. Content-driven (cases are JSON in `public/data/cases/`). | React |
| **Colony Survival** | City-building and survival simulation on a procedural 256x256 map with villagers that have traits, skills and needs, hierarchical pathfinding and seasons. | Phaser 3 |
| **Зеркальная Ложа** (Mirror Lodge) | Real-time two-player co-op escape in 3D: the clues for your mechanisms are held by your partner. | three.js / react-three-fiber |

`src/games/among-the-quiet/` also contains a game engine (with tests) that is not registered in the portal yet.

## Features

- Portal with game catalog, game pages, a full-screen launcher, profile, achievements, news and settings.
- Local progress through a `StorageAdapter` abstraction (browser `localStorage`) with versioned save migrations.
- Optional cloud features through Supabase: email/password sign-in, Google and GitHub OAuth (provider setup in [docs/superpowers/notes/oauth-setup.md](docs/superpowers/notes/oauth-setup.md)), cloud saves with conflict resolution, and realtime transport for the co-op game. Without Supabase variables the portal runs in guest-only mode.
- Games are lazy-loaded as separate chunks, so Phaser and three.js load only when needed.

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS (CSS variables, themes via `data-theme`) · Zustand · Phaser 3 · three.js with react-three-fiber · Framer Motion · Supabase · Vitest.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm test           # Vitest
```

### Configuration

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`) to enable cloud features:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |

Cloud saves use a `game_saves` table with `user_id`, `data`, `schema_version`, `updated_at` and `updated_device` columns. The schema is not part of this repository.

## Architecture

Each game is a self-contained module implementing the `GameModule` contract (`src/types/game-module.ts`). The portal talks to a game only through `PortalBridge` (`src/services/games/PortalBridge.ts`), which provides a `GameContext` (events, saves, achievements, settings). Games are registered in `src/games/index.ts` and loaded lazily through `GameRegistry`.

```
src/
  app/        shell, router, bootstrap, providers
  pages/      portal pages (home, games, launcher, profile, achievements, news, settings, about, login)
  ui/         shared components (primitives, layout, game, feedback, auth, home)
  stores/     Zustand stores (settings, profile, achievements, runtime, auth, sync, toasts)
  services/   SaveManager, AchievementManager, GameRegistry, PortalBridge, News, cloud sync, Supabase
  core/       EventBus, seeded RNG, utilities
  games/
    shadow-trace/     archive and engine (case state, conditions, endings) - systems - ui
    colony/           domain - systems (simulation) - scenes (Phaser) - ui
    lodge/            engine - net (transports) - ui (3D scene, HUD)
    among-the-quiet/  engine only
public/data/  content: detective cases (cases/*.json), news (news/index.json)
tests/        Vitest suites per game and for saves, scoring and cloud sync
docs/         design specs and implementation plans (internal working notes, mostly in Russian)
```

## Testing

`npm test` runs the Vitest suites: simulation determinism and subsystems for Colony (worldgen, pathfinding, jobs, needs, seasons, save round-trip), engine and archive logic for Shadow Trace, the Lodge engine, session and transports, the Among the Quiet engine, save migrations, scoring and cloud sync.

## Deployment

`.github/workflows/deploy.yml` (manual `workflow_dispatch`) builds the site and publishes `dist/` to a server over SSH with rsync. It expects the secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST` and `DEPLOY_USER`. A scheduled workflow (`supabase-keepalive.yml`) pings the Supabase REST endpoint every three days.

## Roadmap

- 0.1: portal, two games, local storage, achievements, settings. Done.
- 0.2: second detective case with case selection and interrogations; technology tree, six more events (raids), a villagers panel; records and transitions; save migration v1 to v2. Done.
- 0.3: IndexedDB, new cases, balancing, more technologies and buildings.
- 1.0: accounts, cloud saves, leaderboards, news from a database (accounts and cloud saves are partly in place through Supabase).
- 2.0: multiplayer and seasonal events (the co-op Lodge game is a first step).

## Disclaimer

All data in Shadow Trace is entirely fictional. The game is a puzzle and is not a tool for real hacking, surveillance or OSINT on real people.

## License

[MIT](LICENSE)
