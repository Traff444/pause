export type PasswordAuthMode = 'sign-in' | 'sign-up';

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const email = normalizeEmail(value);
  const at = email.indexOf('@');
  return at > 0 && at < email.length - 3 && email.includes('.', at + 2);
}

export function passwordValidationMessage(password: string) {
  if (!password) return 'Введи пароль';
  if (password.length < 8) return 'Пароль должен содержать минимум 8 символов';
  return undefined;
}

export function passwordAuthErrorMessage(
  error: unknown,
  mode: PasswordAuthMode,
) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return 'Неверная почта или пароль';
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Аккаунт с этой почтой уже есть — попробуй войти';
  }
  if (message.includes('password') && (message.includes('weak') || message.includes('characters'))) {
    return 'Пароль должен содержать минимум 8 символов';
  }
  if (message.includes('email not confirmed')) {
    return 'Подтверждение почты ещё включено в Supabase';
  }
  if (message.includes('rate') || message.includes('too many')) {
    return 'Слишком много попыток. Подожди минуту и попробуй снова';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Нет связи с сервером. Проверь интернет';
  }

  return mode === 'sign-up'
    ? 'Не получилось создать аккаунт. Попробуй ещё раз'
    : 'Не получилось войти. Проверь данные и интернет';
}
