import { Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/useProfileStore';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/ui/primitives/Button';
import { IconLogout } from '@/ui/icons';
import { cx } from '@/core/utils';

interface ProfileWidgetProps {
  compact?: boolean;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="grid place-items-center rounded-xl font-display font-semibold text-bg"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))',
        boxShadow: '0 0 18px -4px rgb(var(--accent) / 0.6)',
      }}
    >
      {initial}
    </span>
  );
}

export function ProfileWidget({ compact }: ProfileWidgetProps) {
  const profile = useProfileStore((s) => s.profile);
  const points = useAchievementStore((s) => s.points);
  const status = useAuthStore((s) => s.status);
  const openAuth = useAuthStore((s) => s.openAuthModal);
  const signOut = useAuthStore((s) => s.signOut);

  if (status === 'guest') {
    return (
      <Button size="sm" variant="primary" onClick={openAuth}>
        Войти
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/profile"
        className={cx(
          'group flex items-center gap-3 rounded-xl border border-edge/60 bg-panel/50 px-2.5 py-2 transition-all hover:border-accent/40 hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          compact ? '' : 'w-full',
        )}
      >
        <Avatar name={profile.displayName} size={compact ? 34 : 40} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-medium text-ink">{profile.displayName}</p>
          <p className="font-mono text-[0.68rem] text-muted">
            {points.earned}/{points.total} очков
          </p>
        </div>
      </Link>
      {status === 'authed' && (
        <button
          onClick={() => void signOut()}
          aria-label="Выйти"
          className="grid h-9 w-9 place-items-center rounded-xl border border-edge/60 text-muted transition-colors hover:border-bad/50 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <IconLogout width={16} height={16} />
        </button>
      )}
    </div>
  );
}
