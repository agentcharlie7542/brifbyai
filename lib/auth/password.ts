/**
 * 비밀번호 해시·검증 (scrypt, 무외부의존).
 * node:crypto 사용 — Node 런타임(로그인/유저 생성 API)에서만 호출. 엣지 미들웨어에서는 호출 금지.
 *
 * 저장 형식: `<saltHex>:<hashHex>`
 */
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  if (derived.length !== keyBuf.length) return false;
  return timingSafeEqual(derived, keyBuf);
}
