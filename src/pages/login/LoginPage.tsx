import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

/** Full-page entry + OAuth redirect landing. Supabase consumes the URL hash via
 *  detectSessionInUrl; once a session exists we route home. */
export function LoginPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const open = useAuthStore((s) => s.openAuthModal);

  useEffect(() => {
    if (status === 'authed') navigate('/', { replace: true });
    else if (status === 'guest') open();
  }, [status, navigate, open]);

  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <p className="font-mono text-sm text-muted">Подключение…</p>
    </div>
  );
}
