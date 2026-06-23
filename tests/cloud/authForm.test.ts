import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateAuthForm } from '@/ui/auth/authForm';

describe('authForm', () => {
  it('rejects empty and malformed emails', () => {
    expect(validateEmail('')).toMatch(/email/i);
    expect(validateEmail('nope')).toMatch(/email/i);
    expect(validateEmail('a@b.co')).toBeNull();
  });
  it('requires a 6+ char password', () => {
    expect(validatePassword('')).toMatch(/пароль/i);
    expect(validatePassword('12345')).toMatch(/6/);
    expect(validatePassword('123456')).toBeNull();
  });
  it('aggregates form validity', () => {
    expect(validateAuthForm('a@b.co', '123456').ok).toBe(true);
    expect(validateAuthForm('bad', '123456').ok).toBe(false);
  });
});
