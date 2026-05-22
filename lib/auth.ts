export const AUTH_COOKIE = 'brifbyai_auth';

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createPasswordToken(password: string): Promise<string> {
  return sha256Hex(password);
}

export async function verifyPasswordToken(
  token: string | undefined,
  password: string | undefined
): Promise<boolean> {
  if (!token || !password) return false;
  const expected = await sha256Hex(password);
  return token === expected;
}
