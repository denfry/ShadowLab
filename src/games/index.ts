import { GameRegistry } from '@/services/games/GameRegistry';
import { SHADOW_TRACE_DEFINITION } from './shadow-trace/definition';
import { COLONY_DEFINITION } from './colony/definition';

/** Registers the game catalog. Definitions are eager (for the portal UI); each
 *  module is lazy-imported so its code + Phaser only load inside the launcher. */
export function registerGames(): void {
  GameRegistry.register({
    definition: SHADOW_TRACE_DEFINITION,
    load: () => import('./shadow-trace/ShadowTraceGameModule').then((m) => m.shadowTraceModule),
  });

  GameRegistry.register({
    definition: COLONY_DEFINITION,
    load: () => import('./colony/ColonyGameModule').then((m) => m.colonyModule),
  });
}
