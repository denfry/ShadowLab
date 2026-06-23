import { SectionTitle } from '@/ui/primitives/SectionTitle';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="hero-surface scanlines p-8">
        <h1 className="font-display text-3xl font-bold text-ink neon-text">Denfry / ShadowLab Games</h1>
        <p className="mt-3 text-muted">
          Независимая игровая лаборатория. Портал запускает игры прямо в браузере на единой
          архитектуре: каждая игра — самодостаточный модуль, портал даёт общий профиль, прогресс,
          достижения и сохранения.
        </p>
      </section>

      <section>
        <SectionTitle eyebrow="технологии" title="Стек" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Frontend', 'Vite · React · TypeScript'],
            ['UI', 'TailwindCSS · CSS-переменные · Motion'],
            ['Игры', 'Phaser 3 · ECS-lite системы'],
            ['Данные', 'localStorage → IndexedDB → Supabase (v1.0)'],
          ].map(([k, v]) => (
            <div key={k} className="panel-inset p-4 shadow-e1">
              <p className="label-mono mb-1">{k}</p>
              <p className="font-mono text-sm text-ink">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-glass border-warn/40 p-6">
        <p className="label-mono mb-2 text-warn">Дисклеймер · Shadow Trace</p>
        <p className="text-sm leading-relaxed text-muted">
          Все данные, имена, сообщения и логи в детективной игре Shadow Trace полностью вымышлены и
          созданы исключительно для головоломки. Игра <strong className="text-ink">не</strong>{' '}
          является инструментом для реального взлома, слежки или OSINT по реальным людям и не должна
          использоваться в таких целях. Любые совпадения с реальными людьми или событиями случайны.
        </p>
      </section>
    </div>
  );
}
