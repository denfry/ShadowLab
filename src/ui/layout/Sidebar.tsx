import { NavLink } from 'react-router-dom';
import { cx } from '@/core/utils';
import { NAV_ITEMS } from './navItems';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="px-3 pb-3 pt-1">
        <span className="label-mono">Навигация</span>
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
              isActive
                ? 'bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.35)]'
                : 'text-muted hover:bg-panel/60 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cx(
                  'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="shrink-0">{item.icon}</span>
              <span className="font-display tracking-wide">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <div className="mt-auto p-3">
        <div className="panel-inset p-3">
          <p className="label-mono mb-1">Сборка</p>
          <p className="font-mono text-xs text-muted">ShadowLab v0.1.0 · local</p>
        </div>
      </div>
    </nav>
  );
}
