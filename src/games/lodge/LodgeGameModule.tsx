import type { GameContext, GameInstance, GameModule } from '@/types/game-module';
import { LODGE_DEFINITION } from './definition';
import { LodgeGame } from './ui/LodgeGame';

/** Lodge is a pure-React game (no Phaser): mount() is a no-op and the whole
 *  experience lives in the HUD overlay, like Shadow Trace. */
export const lodgeModule: GameModule = {
  definition: LODGE_DEFINITION,
  payloadVersion: 1,

  async mount(_container: HTMLElement, _ctx: GameContext): Promise<GameInstance> {
    return {
      pause() {},
      resume() {},
      destroy() {},
    };
  },

  Hud: ({ ctx }) => <LodgeGame ctx={ctx} />,
};
