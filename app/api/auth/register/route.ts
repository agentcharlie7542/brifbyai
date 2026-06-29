import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createUser, getUserByEmail } from '@/lib/db/repositories/users';
import { hashPassword } from '@/lib/auth/password';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(128),
  password: z.string().min(8),
  passwordConfirm: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

    const { email, name, password, passwordConfirm } = parsed.data;
    if (!email.endsWith('@aidenlab.io')) {
      return NextResponse.json({ error: '허용되지 않는 이메일 도메인' }, { status: 403 });
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: '비밀번호 확인이 일치하지 않습니다.' }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) return NextResponse.json({ error: '이미 등록된 계정이 있습니다.' }, { status: 409 });

    // create inactive user — admin must approve
    const hashed = await hashPassword(password);
    const user = await createUser({ email, name, passwordHash: hashed, isActive: false, role: 'editor' });

    const { ip, userAgent } = requestMeta(req);
    await logAction({ userId: user.id, action: 'create_user', metadata: { requested: true }, ip, userAgent });

    return NextResponse.json({ id: user.id });
  } catch (err) {
    console.error('[api/auth/register]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
