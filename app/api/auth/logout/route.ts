import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (session) {
    const { ip, userAgent } = requestMeta(req);
    await logAction({ userId: session.userId, action: 'logout', ip, userAgent });
  }
  cookies().delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
