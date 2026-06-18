import type { GameContext, GameInstance, GameModule } from '@/types/game-module';
import { SHADOW_TRACE_DEFINITION } from './definition';
import { ShadowTraceGame } from './ui/ShadowTraceGame';

/**
 * Shadow Trace is a content-driven, pure-React game: there is no Phaser canvas,
 * so mount() is a no-op and the entire experience lives in the HUD overlay.
 */
export const shadowTraceModule: GameModule = {
  definition: SHADOW_TRACE_DEFINITION,
  payloadVersion: 1,

  async mount(_container: HTMLElement, _ctx: GameContext): Promise<GameInstance> {
    return {
      pause() {},
      resume() {},
      destroy() {},
    };
  },

  Hud: ({ ctx }) => <ShadowTraceGame ctx={ctx} />,
};
