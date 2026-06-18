import { useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { SaveManager } from '@/services/save/SaveManager';
import { appBus } from '@/core/events/appBus';
import { Button } from '@/ui/primitives/Button';
import { Modal } from '@/ui/primitives/Modal';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { cx } from '@/core/utils';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge/40 py-3 last:border-0">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-bg-2 accent-accent"
    />
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'relative h-6 w-11 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        on ? 'border-accent/60 bg-accent/30' : 'border-edge/70 bg-bg-2',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform',
          on ? 'translate-x-6 shadow-glow' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function SettingsPage() {
  const s = useSettingsStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const exportSave = () => {
    const data = JSON.stringify(SaveManager.exportAll(), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `denfry-save-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appBus.emit('toast', { kind: 'success', title: 'Экспорт', message: 'Файл сохранения скачан', icon: '⬇️' });
  };

  const importSave = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        void SaveManager.importAll(parsed).then(() => {
          appBus.emit('toast', { kind: 'success', title: 'Импорт', message: 'Сохранение загружено', icon: '⬆️' });
          setTimeout(() => location.reload(), 600);
        });
      } catch {
        appBus.emit('toast', { kind: 'error', title: 'Импорт', message: 'Повреждённый файл', icon: '⚠️' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <SectionTitle eyebrow="конфигурация" title="Настройки" />

      <section className="panel p-5">
        <p className="label-mono mb-2">Звук</p>
        <Row label="Общая громкость">
          <Slider value={s.audio.master} onChange={(v) => s.set('audio', { ...s.audio, master: v })} />
        </Row>
        <Row label="Музыка">
          <Slider value={s.audio.music} onChange={(v) => s.set('audio', { ...s.audio, music: v })} />
        </Row>
        <Row label="Эффекты">
          <Slider value={s.audio.sfx} onChange={(v) => s.set('audio', { ...s.audio, sfx: v })} />
        </Row>
        <Row label="Без звука">
          <Toggle on={s.audio.muted} onClick={() => s.set('audio', { ...s.audio, muted: !s.audio.muted })} />
        </Row>
      </section>

      <section className="panel p-5">
        <p className="label-mono mb-2">Графика</p>
        <Row label="Качество">
          <div className="inline-flex gap-1 rounded-lg border border-edge/60 bg-panel/40 p-1">
            {(['low', 'med', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => s.set('graphics', { ...s.graphics, quality: q })}
                className={cx(
                  'rounded-lg px-3 py-1.5 font-mono text-xs uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  s.graphics.quality === q ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink',
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Частицы">
          <Toggle on={s.graphics.particles} onClick={() => s.set('graphics', { ...s.graphics, particles: !s.graphics.particles })} />
        </Row>
        <Row label="Меньше анимаций">
          <Toggle on={s.reducedMotion} onClick={() => s.set('reducedMotion', !s.reducedMotion)} />
        </Row>
      </section>

      <section className="panel p-5">
        <p className="label-mono mb-2">Язык</p>
        <Row label="Язык интерфейса">
          <div className="inline-flex gap-1 rounded-lg border border-edge/60 bg-panel/40 p-1">
            {(['ru', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => s.set('language', l)}
                className={cx(
                  'rounded-lg px-3 py-1.5 font-mono text-xs uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  s.language === l ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section className="panel p-5">
        <p className="label-mono mb-3">Управление данными</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={exportSave}>
            Экспорт JSON
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Импорт JSON
          </Button>
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>
            Сбросить всё
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importSave(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)} title="Сбросить все данные?">
        <p className="text-sm text-muted">
          Будут удалены профиль, достижения, настройки и все сохранения. Действие необратимо.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="subtle" onClick={() => setConfirmWipe(false)}>
            Отмена
          </Button>
          <Button
            variant="danger"
            onClick={() => void SaveManager.wipeAll().then(() => location.reload())}
          >
            Удалить всё
          </Button>
        </div>
      </Modal>
    </div>
  );
}
