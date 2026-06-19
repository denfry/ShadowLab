import type { GameSave } from '@/types/save';
import { Button } from '@/ui/primitives/Button';
import { IconPlay } from '@/ui/icons';
import { cx } from '@/core/utils';

interface SaveSlotCardProps {
  slot: number;
  save: GameSave | null;
  onLoad: () => void;
  onDelete?: () => void;
}

export function SaveSlotCard({ slot, save, onLoad, onDelete }: SaveSlotCardProps) {
  const isAuto = slot === 0;
  const empty = !save;

  return (
    <div
      className={cx(
        'panel flex items-center gap-4 p-4 shadow-e1 transition-all',
        empty ? 'border-dashed opacity-70' : 'border-edge/70 hover:border-accent/40',
      )}
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bg-2 font-mono text-sm text-muted">
        {isAuto ? 'AUTO' : `0${slot}`}
      </div>

      <div className="min-w-0 flex-1">
        {empty ? (
          <p className="text-sm text-muted">Пустой слот</p>
        ) : (
          <>
            <p className="truncate font-display text-sm font-medium text-ink">{save!.label}</p>
            <p className="font-mono text-[0.68rem] text-muted">
              обновлено {new Date(save!.updatedAt).toLocaleString('ru-RU')}
            </p>
          </>
        )}
      </div>

      {!empty && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" icon={<IconPlay width={14} height={14} />} onClick={onLoad}>
            Продолжить
          </Button>
          {onDelete && (
            <Button size="sm" variant="danger" onClick={onDelete} aria-label="Удалить">
              ✕
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
