import { NextResponse } from 'next/server';
import { updateUser, getUserById } from '@/lib/db/repositories/users';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getUserById(params.id);
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    await updateUser(params.id, { isActive: true });

    const { ip, userAgent } = requestMeta(req);
    await logAction({ userId: params.id, action: 'update_user', metadata: { approved: true }, ip, userAgent });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/users/approve]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
