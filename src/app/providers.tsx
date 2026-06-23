import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastHost } from '@/ui/feedback/ToastHost';
import { AuthModal } from '@/ui/auth/AuthModal';
import { ConflictModal } from '@/ui/auth/ConflictModal';

export function AppProviders() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
      <AuthModal />
      <ConflictModal />
    </>
  );
}
