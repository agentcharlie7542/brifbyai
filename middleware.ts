import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, verifyPasswordToken } from '@/lib/auth';

const PUBLIC_PATHS = ['/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const password = process.env.LOGIN_PASSWORD;
  // If the gate is not configured, let traffic through (local dev convenience).
  if (!password) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (verifyPasswordToken(token, password)) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals, static files, and the favicon. Everything else is gated.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)'],
};
