export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Введите email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Некорректный email';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (!pw) return 'Введите пароль';
  if (pw.length < 6) return 'Минимум 6 символов';
  return null;
}

export interface AuthFormErrors {
  email: string | null;
  password: string | null;
  ok: boolean;
}

export function validateAuthForm(email: string, password: string): AuthFormErrors {
  const e = validateEmail(email);
  const p = validatePassword(password);
  return { email: e, password: p, ok: !e && !p };
}
