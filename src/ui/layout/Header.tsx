import { Link } from 'react-router-dom';
import { IconMenu } from '@/ui/icons';
import { ProfileWidget } from '@/ui/profile/ProfileWidget';

interface HeaderProps {
  onMenu: () => void;
}

export function Header({ onMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-edge/60 bg-bg/60 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <button
          className="grid h-10 w-10 place-items-center rounded-xl border border-edge/60 text-muted transition-colors hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 lg:hidden"
          onClick={onMenu}
          aria-label="Меню"
        >
          <IconMenu />
        </button>

        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className="relative grid h-9 w-9 place-items-center">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent to-accent2 opacity-90 shadow-e2 transition-transform group-hover:scale-105" />
            <span className="relative font-display text-base font-bold text-bg">S</span>
          </span>
          <span className="leading-none">
            <span className="block font-display text-sm font-semibold tracking-[0.2em] text-ink">
              SHADOWLAB
            </span>
            <span className="block font-mono text-[0.6rem] tracking-[0.3em] text-muted">
              DENFRY · GAMES
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="chip hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-good" />
            online · local
          </span>
          <ProfileWidget compact />
        </div>
      </div>
    </header>
  );
}
