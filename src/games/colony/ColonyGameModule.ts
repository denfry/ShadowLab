import Phaser from 'phaser';
import { createElement } from 'react';
import type { GameContext, GameInstance, GameModule } from '@/types/game-module';
import { randomSeed } from '@/core/utils/rng';
import { COLONY_DEFINITION } from './definition';
import type { ColonyState } from './domain/types';
import { createColony } from './domain/createColony';
import { toSave, fromSave, type ColonySave } from './domain/save';
import { WorldScene } from './scenes/WorldScene';
import { ColonyHud } from './ui/ColonyHud';

const COLONY_PAYLOAD_VERSION = 5;

export const colonyModule: GameModule = {
  definition: COLONY_DEFINITION,
  payloadVersion: COLONY_PAYLOAD_VERSION,

  async mount(container: HTMLElement, ctx: GameContext): Promise<GameInstance> {
    let state: ColonyState | null = null;
    if (ctx.mode === 'load') {
      const loaded = (await ctx.save.load(ctx.slot)) as ColonySave | null;
      if (loaded && loaded.version === COLONY_PAYLOAD_VERSION) state = fromSave(loaded);
    }
    if (!state) state = createColony(randomSeed());

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      backgroundColor: '#0d140c',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      render: { antialias: true, pixelArt: false },
      scene: [],
    });
    game.scene.add('world', WorldScene, true, { state, ctx });

    return {
      pause() { game.scene.getScene('world')?.scene.pause(); },
      resume() { game.scene.getScene('world')?.scene.resume(); },
      destroy() { game.destroy(true); },
    };
  },

  Hud: ({ ctx }) => createElement(ColonyHud, { ctx }),
};
