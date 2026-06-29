'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password !== passwordConfirm) {
      setMessage('비밀번호와 확인이 일치하지 않습니다.');
      return;
    }
    if (!email.endsWith('@aidenlab.io')) {
      setMessage('@aidenlab.io 이메일로만 가입할 수 있습니다.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, passwordConfirm }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || '등록에 실패했습니다.');
      setMessage('가입 신청이 접수되었습니다. 관리자의 승인 후 로그인할 수 있습니다.');
      setEmail('');
      setName('');
      setPassword('');
      setPasswordConfirm('');
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">회원가입 신청</h1>
        <p className="mt-1 text-sm text-muted-foreground">@aidenlab.io 이메일로 가입 신청을 할 수 있습니다.</p>

        <label className="mt-6 block text-sm font-medium">이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
          required
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-sm font-medium">이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-sm font-medium">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-sm font-medium">비밀번호 확인</label>
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {message ? <p className="mt-3 text-sm text-yakkihou-ng">{message}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <a href="/login" className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm shadow-sm hover:bg-accent">취소</a>
          <button type="submit" disabled={loading} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            {loading ? '신청 중...' : '가입 신청'}
          </button>
        </div>
      </form>
    </main>
  );
}
