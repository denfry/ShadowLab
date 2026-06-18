import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { GameRegistry } from '@/services/games/GameRegistry';
import { usePageTheme } from '@/ui/hooks/usePageTheme';
import { GameCanvasWrapper } from '@/ui/game/GameCanvasWrapper';
import type { GameId, LaunchMode } from '@/types/game-module';

export function GameLauncherPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const def = id && GameRegistry.has(id) ? GameRegistry.getDefinition(id as GameId)! : null;

  // Hook order must stay stable, so theme runs before the early return guard.
  usePageTheme(def?.theme ?? 'portal');

  if (!def) return <Navigate to="/games" replace />;

  const isNew = params.get('new') === '1';
  const mode: LaunchMode = isNew ? 'new' : 'load';
  const slot = Number(params.get('slot') ?? 0);

  // Forward extra launch params (e.g. ?case=...) to the game via GameContext.
  const launchParams: Record<string, string> = {};
  const caseId = params.get('case');
  if (caseId) launchParams.case = caseId;

  return (
    <GameCanvasWrapper
      // key forces a clean remount when the launch target changes.
      key={`${def.id}:${mode}:${slot}:${caseId ?? ''}`}
      gameId={def.id}
      mode={mode}
      slot={slot}
      params={launchParams}
      title={def.title}
      bootHint={def.bootHint}
    />
  );
}
