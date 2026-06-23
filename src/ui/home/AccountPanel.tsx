import { useAuthStore } from '@/stores/useAuthStore';
import { useSyncStore } from '@/stores/useSyncStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { Button } from '@/ui/primitives/Button';
import { Tag } from '@/ui/primitives/Tag';
import { Avatar } from '@/ui/profile/ProfileWidget';

const PHASE_LABEL: Record<string, string> = {
  idle: 'Не синхронизировано',
  syncing: 'Синхронизация…',
  synced: 'Синхронизировано',
  offline: 'Оффлайн',
  error: 'Ошибка синхронизации',
};

export function AccountPanel() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const openAuth = useAuthStore((s) => s.openAuthModal);
  const profile = useProfileStore((s) => s.profile);
  const phase = useSyncStore((s) => s.phase);

  if (status !== 'authed') {
    return (
      <div className="panel flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-ink">Сохраняйте прогресс в облаке</p>
          <p className="text-sm text-muted">
            Войдите, чтобы синхронизировать достижения и сохранения между устройствами.
          </p>
        </div>
        <Button variant="solid" onClick={openAuth}>
          Войти / Создать аккаунт
        </Button>
      </div>
    );
  }

  return (
    <div className="panel flex flex-wrap items-center gap-4 p-5">
      <Avatar name={profile.displayName} size={48} />
      <div className="min-w-0">
        <p className="font-display text-lg text-ink">{profile.displayName}</p>
        <p className="truncate font-mono text-xs text-muted">{user?.email ?? ''}</p>
      </div>
      <span className="ml-auto">
        <Tag tone={phase === 'error' ? 'warn' : phase === 'synced' ? 'good' : 'accent'}>
          {PHASE_LABEL[phase]}
        </Tag>
      </span>
    </div>
  );
}
