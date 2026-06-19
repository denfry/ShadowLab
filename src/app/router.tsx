import { createBrowserRouter, Link } from 'react-router-dom';
import { AppLayout } from '@/ui/layout/AppLayout';
import { HomePage } from '@/pages/home/HomePage';
import { GamesPage } from '@/pages/games/GamesPage';
import { GameDetailPage } from '@/pages/games/GameDetailPage';
import { GameLauncherPage } from '@/pages/play/GameLauncherPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { AchievementsPage } from '@/pages/achievements/AchievementsPage';
import { NewsPage } from '@/pages/news/NewsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { AboutPage } from '@/pages/about/AboutPage';
import { LoginPage } from '@/pages/login/LoginPage';

function NotFound() {
  return (
    <div className="panel p-10 text-center">
      <p className="font-display text-2xl text-ink">404</p>
      <p className="mt-2 text-muted">Страница не найдена.</p>
      <Link to="/" className="mt-4 inline-block text-accent hover:underline">
        ← на главную
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'games', element: <GamesPage /> },
      { path: 'games/:id', element: <GameDetailPage /> },
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'news/:slug', element: <NewsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  // The launcher is full-screen and intentionally outside the portal chrome.
  { path: '/play/:id', element: <GameLauncherPage /> },
  { path: '/login', element: <LoginPage /> },
]);
