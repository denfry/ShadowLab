import type { ReactNode } from 'react';
import { IconHome, IconGames, IconTrophy, IconNews, IconUser, IconSettings, IconInfo } from '@/ui/icons';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: <IconHome />, end: true },
  { to: '/games', label: 'Игры', icon: <IconGames /> },
  { to: '/achievements', label: 'Достижения', icon: <IconTrophy /> },
  { to: '/news', label: 'Новости', icon: <IconNews /> },
  { to: '/profile', label: 'Профиль', icon: <IconUser /> },
  { to: '/settings', label: 'Настройки', icon: <IconSettings /> },
  { to: '/about', label: 'О проекте', icon: <IconInfo /> },
];
