/**
 * 서버 컴포넌트·라우트 핸들러에서 현재 로그인 유저 조회.
 * (미들웨어에서는 next/headers 대신 req.cookies 를 직접 쓰므로 여기 사용 금지)
 */
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from './session';

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
