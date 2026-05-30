import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { getUserByEmail, setLastLogin } from '@/lib/db/repositories/users';
import { verifyPassword } from '@/lib/auth/password';
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '@/lib/auth/session';
import { logAction } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

async function loginAction(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '')
    .toLowerCase()
    .trim();
  const password = String(formData.get('password') ?? '');

  const h = headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    undefined;
  const userAgent = h.get('user-agent') ?? undefined;

  const user = await getUserByEmail(email);
  const passwordOk =
    !!user &&
    user.isActive &&
    (await verifyPassword(password, user.passwordHash));

  if (!user || !passwordOk) {
    await logAction({
      userId: user?.id ?? null,
      action: 'login_failed',
      metadata: { email },
      ip,
      userAgent,
    });
    redirect('/login?error=1');
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name ?? undefined,
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  await setLastLogin(user.id);
  await logAction({ userId: user.id, action: 'login', ip, userAgent });

  redirect('/');
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const hasError = Boolean(searchParams.error);

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold tracking-tight">brifbyai</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          내부 도구입니다. 계정으로 로그인하세요.
        </p>

        <label className="mt-6 block text-sm font-medium">이메일</label>
        <input
          name="email"
          type="email"
          autoFocus
          required
          autoComplete="email"
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-sm font-medium">비밀번호</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {hasError ? (
          <p className="mt-3 text-sm text-yakkihou-ng">
            이메일 또는 비밀번호가 올바르지 않습니다.
          </p>
        ) : null}

        <button
          type="submit"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
