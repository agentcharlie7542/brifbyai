import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, verifyPasswordToken, createPasswordToken } from '@/lib/auth';

async function loginAction(formData: FormData) {
  'use server';

  const password = String(formData.get('password') ?? '');
  const expected = process.env.LOGIN_PASSWORD;

  if (!expected) {
    throw new Error('LOGIN_PASSWORD is not set');
  }

  if (password !== expected) {
    redirect('/login?error=1');
  }

  const token = createPasswordToken(expected);
  cookies().set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

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
          내부 도구입니다. 비밀번호를 입력하세요.
        </p>

        <label className="mt-6 block text-sm font-medium">비밀번호</label>
        <input
          name="password"
          type="password"
          autoFocus
          required
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {hasError ? (
          <p className="mt-3 text-sm text-yakkihou-ng">
            비밀번호가 올바르지 않습니다.
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
