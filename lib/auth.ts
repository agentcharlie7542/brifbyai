import { createHash } from 'crypto';

export const AUTH_COOKIE = 'brifbyai_auth';

export function createPasswordToken(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPasswordToken(
  token: string | undefined,
  password: string | undefined
): boolean {
  if (!token || !password) return false;
  return token === createPasswordToken(password);
}
