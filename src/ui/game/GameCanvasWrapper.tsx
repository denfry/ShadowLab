import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ComponentType } from 'react';
import type { GameContext, GameId, GameInstance, LaunchMode } from '@/types/game-module';
import { GameRegistry } from '@/services/games/GameRegistry';
import { createGameContext } from '@/services/games/PortalBridge';
import { AchievementManager } from '@/services/achievements/AchievementManager';
import { SaveManager } from '@/services/save/SaveManager';
import { LoadingScreen } from '@/ui/feedback/LoadingScreen';
import { Button } from '@/ui/primitives/Button';
import { IconArrowLeft } from '@/ui/icons';

interface GameCanvasWrapperProps {
  gameId: GameId;
  mode: LaunchMode;
  slot: number;
  params?: Record<string, string>;
  bootHint?: string;
  title: string;
}

type HudComponent = ComponentType<{ ctx: GameContext }>;

/**
 * Owns the entire game lifecycle for one launch. Mounts the Phaser runtime once,
 * renders the React HUD as a sibling subtree (so HUD updates never re-render the
 * canvas), and tears everything down on unmount. Memoized so portal state churn
 * can't remount the canvas.
 */
function GameCanvasWrapperImpl({ gameId, mode, slot, params, bootHint, title }: GameCanvasWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<GameContext | null>(null);
  const [phase, setPhase] = useState<'loading' | 'running' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [Hud, setHud] = useState<HudComponent | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let instance: GameInstance | null = null;
    let ctx: GameContext | null = null;

    (async () => {
      try {
        const module = await GameRegistry.load(gameId);
        if (cancelled || !containerRef.current) return;

        ctx = createGameContext({
          gameId,
          mode,
          slot,
          params,
          payloadVersion: module.payloadVersion,
          onExit: () => navigate('/games'),
        });
        ctxRef.current = ctx;

        instance = await module.mount(containerRef.current, ctx);
        if (cancelled) {
          instance.destroy();
          ctx.dispose();
          return;
        }

        setHud(() => module.Hud ?? null);
        setPhase('running');

        // Global achievements: first launch + "played both games".
        AchievementManager.unlock('global.first_launch');
        const played = new Set(Object.keys(SaveManager.getProfile().stats.gamesPlayed));
        played.add(gameId);
        AchievementManager.progress('global.both_games', played.size);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
      ctx?.dispose();
      ctxRef.current = null;
    };
    // Re-run only when the actual launch target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode, slot]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-bg">
      {/* Phaser mounts here. Pure-React games leave it as ambient backdrop. */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Slim launcher chrome — always available exit. */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center gap-3 p-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<IconArrowLeft width={16} height={16} />}
          className="pointer-events-auto"
          onClick={() => ctxRef.current?.exit() ?? navigate('/games')}
        >
          Выход
        </Button>
        <span className="chip pointer-events-auto">{title}</span>
      </div>

      {phase === 'loading' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-bg">
          <LoadingScreen label="Инициализация" hint={bootHint} />
        </div>
      )}

      {phase === 'error' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-bg p-6">
          <div className="panel max-w-md p-6 text-center">
            <p className="mb-2 font-display text-lg text-bad">Не удалось запустить игру</p>
            <p className="mb-4 font-mono text-xs text-muted">{error}</p>
            <Button onClick={() => navigate('/games')}>Назад к играм</Button>
          </div>
        </div>
      )}

      {phase === 'running' && Hud && ctxRef.current && <Hud ctx={ctxRef.current} />}
    </div>
  );
}

export const GameCanvasWrapper = memo(GameCanvasWrapperImpl);
