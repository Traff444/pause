import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  normalizeEmail,
  passwordAuthErrorMessage,
  passwordValidationMessage,
} from './auth';

describe('password auth helpers', () => {
  it('normalizes and validates email addresses', () => {
    expect(normalizeEmail('  Pilot@Example.COM ')).toBe('pilot@example.com');
    expect(isValidEmail('pilot@example.com')).toBe(true);
    expect(isValidEmail('pilot@example')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('requires an eight-character password', () => {
    expect(passwordValidationMessage('')).toBe('Введи пароль');
    expect(passwordValidationMessage('1234567')).toContain('8');
    expect(passwordValidationMessage('12345678')).toBeUndefined();
  });

  it('turns Supabase errors into actionable Russian messages', () => {
    expect(
      passwordAuthErrorMessage(new Error('Invalid login credentials'), 'sign-in'),
    ).toBe('Неверная почта или пароль');
    expect(
      passwordAuthErrorMessage(new Error('User already registered'), 'sign-up'),
    ).toContain('уже есть');
    expect(
      passwordAuthErrorMessage(new Error('Email not confirmed'), 'sign-in'),
    ).toContain('Supabase');
  });
});
