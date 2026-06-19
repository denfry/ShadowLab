import { Modal } from '@/ui/primitives/Modal';
import { Button } from '@/ui/primitives/Button';
import { useSyncStore } from '@/stores/useSyncStore';
import { CloudSync } from '@/services/cloud/CloudSync';
import { formatPlaytime } from '@/services/cloud/saveSummary';

export function ConflictModal() {
  const conflict = useSyncStore((s) => s.conflict);
  const open = Boolean(conflict);
  const close = () => useSyncStore.getState().setConflict(null);

  return (
    <Modal open={open} onClose={close} title="Конфликт сохранений">
      {conflict && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Прогресс на этом устройстве и в облаке различается. Какую версию оставить?
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel p-4">
              <p className="mb-2 font-display text-sm text-ink">Это устройство</p>
              <p className="text-xs text-muted">Время: {formatPlaytime(conflict.localSummary.playtimeSec)}</p>
              <p className="text-xs text-muted">Достижения: {conflict.localSummary.achievementsUnlocked}</p>
              <p className="text-xs text-muted">Сохранений: {conflict.localSummary.totalSlots}</p>
              <Button variant="solid" className="mt-3 w-full" onClick={() => void CloudSync.resolveConflict('local')}>
                Оставить это
              </Button>
            </div>
            <div className="panel p-4">
              <p className="mb-2 font-display text-sm text-ink">Облако</p>
              <p className="text-xs text-muted">Время: {formatPlaytime(conflict.cloudSummary.playtimeSec)}</p>
              <p className="text-xs text-muted">Достижения: {conflict.cloudSummary.achievementsUnlocked}</p>
              <p className="text-xs text-muted">Сохранений: {conflict.cloudSummary.totalSlots}</p>
              <p className="mt-1 font-mono text-[0.6rem] text-muted">{conflict.cloudUpdatedAt.slice(0, 16).replace('T', ' ')}</p>
              <Button variant="primary" className="mt-3 w-full" onClick={() => void CloudSync.resolveConflict('cloud')}>
                Оставить облако
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
