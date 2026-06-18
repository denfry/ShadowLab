import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ToastHost } from '@/ui/feedback/ToastHost';

export function AppProviders() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  );
}
