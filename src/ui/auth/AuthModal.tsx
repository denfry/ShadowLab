import { useState } from 'react';
import { Modal } from '@/ui/primitives/Modal';
import { Button } from '@/ui/primitives/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { validateAuthForm } from './authForm';
import { isCloudConfigured } from '@/services/supabase/client';

type Tab = 'in' | 'up';

export function AuthModal() {
  const open = useAuthStore((s) => s.authModalOpen);
  const close = useAuthStore((s) => s.closeAuthModal);
  const pending = useAuthStore((s) => s.pending);
  const error = useAuthStore((s) => s.error);
  const notice = useAuthStore((s) => s.notice);
  const signIn = useAuthStore((s) => s.signInPassword);
  const signUp = useAuthStore((s) => s.signUpPassword);
  const oauth = useAuthStore((s) => s.signInOAuth);

  const [tab, setTab] = useState<Tab>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = () => {
    const v = validateAuthForm(email, password);
    if (!v.ok) {
      setLocalErr(v.email ?? v.password);
      return;
    }
    setLocalErr(null);
    if (tab === 'in') void signIn(email, password);
    else void signUp(email, password);
  };

  const cloud = isCloudConfigured();

  return (
    <Modal open={open} onClose={close} title={tab === 'in' ? 'Вход в аккаунт' : 'Создать аккаунт'}>
      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'in' ? 'primary' : 'subtle'} size="sm" onClick={() => setTab('in')}>
          Вход
        </Button>
        <Button variant={tab === 'up' ? 'primary' : 'subtle'} size="sm" onClick={() => setTab('up')}>
          Регистрация
        </Button>
      </div>

      {!cloud && (
        <p className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
          Облако не настроено. Игра работает локально; вход появится после настройки Supabase.
        </p>
      )}

      <div className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-edge/60 bg-panel/50 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
        />
        <input
          type="password"
          autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
          placeholder="пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full rounded-xl border border-edge/60 bg-panel/50 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
        />

        {(localErr || error) && <p className="text-xs text-bad">{localErr ?? error}</p>}
        {notice && <p className="text-xs text-good">{notice}</p>}

        <Button variant="solid" className="w-full" loading={pending} disabled={!cloud} onClick={submit}>
          {tab === 'in' ? 'Войти' : 'Зарегистрироваться'}
        </Button>

        <div className="flex items-center gap-3 py-1 text-[0.65rem] uppercase tracking-widest text-muted">
          <span className="h-px flex-1 bg-edge/60" /> или <span className="h-px flex-1 bg-edge/60" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={!cloud || pending} onClick={() => void oauth('google')}>
            Google
          </Button>
          <Button variant="ghost" disabled={!cloud || pending} onClick={() => void oauth('github')}>
            GitHub
          </Button>
        </div>
      </div>
    </Modal>
  );
}
