import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/supabase/client', () => ({ isCloudConfigured: () => true }));
vi.mock('@/services/supabase/auth', () => ({
  signInPassword: vi.fn(),
  signUpPassword: vi.fn(),
  signInOAuth: vi.fn(),
  signOut: vi.fn(),
  getCurrentSession: vi.fn(),
  onAuthChange: vi.fn(() => () => {}),
}));

import * as auth from '@/services/supabase/auth';
import { useAuthStore } from '@/stores/useAuthStore';

beforeEach(() => {
  useAuthStore.setState({
    status: 'loading', user: null, session: null,
    error: null, notice: null, pending: false, authModalOpen: false,
  });
  vi.clearAllMocks();
});

describe('useAuthStore', () => {
  it('sets error on failed sign-in and clears pending', async () => {
    (auth.signInPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'bad creds' });
    await useAuthStore.getState().signInPassword('a@b.co', 'pw1234');
    expect(useAuthStore.getState().error).toBe('bad creds');
    expect(useAuthStore.getState().pending).toBe(false);
  });

  it('shows a confirmation notice on sign-up needing confirmation', async () => {
    (auth.signUpPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, needsConfirmation: true });
    await useAuthStore.getState().signUpPassword('a@b.co', 'pw1234');
    expect(useAuthStore.getState().notice).toMatch(/почту/i);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('drops to guest on sign-out', async () => {
    (auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useAuthStore.setState({ status: 'authed', pending: true, error: 'x', authModalOpen: true });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().pending).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().authModalOpen).toBe(false);
  });
});
