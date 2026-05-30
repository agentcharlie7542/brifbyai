/**
 * 세션 JWT 서명·검증 (jose, 엣지 호환).
 * 미들웨어(엣지) + 서버 컴포넌트/라우트(노드) 양쪽에서 사용 가능.
 *
 * AUTH_SECRET 환경변수 필요 (예: `openssl rand -base64 32`).
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'brifbyai_session';
const ALG = 'HS256';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  name?: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      'AUTH_SECRET 환경변수가 설정되지 않았습니다. (예: openssl rand -base64 32)'
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(
  payload: SessionPayload,
  maxAgeSec: number = DEFAULT_MAX_AGE
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = DEFAULT_MAX_AGE;
