import { NextResponse } from 'next/server';

import {
  getInfluencer,
  updateInfluencer,
} from '@/lib/db/repositories/influencers';
import { generatePersona } from '@/lib/influencer/persona';
import type { SocialProfile } from '@/lib/social/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.CLAUDE_ADMIN_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CLAUDE_ADMIN_KEY 가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const influencer = await getInfluencer(params.id);
    if (!influencer) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const profile = influencer.profile as unknown as SocialProfile | null;
    if (!profile || !profile.posts || profile.posts.length === 0) {
      return NextResponse.json(
        { error: '분석할 게시물 데이터가 없습니다. 게시물을 먼저 추가하세요.' },
        { status: 400 }
      );
    }

    const persona = await generatePersona(profile, apiKey);

    const updated = await updateInfluencer(params.id, {
      persona: persona as unknown as Record<string, unknown>,
    });

    const currentUser = await getCurrentUser();
    const { ip, userAgent } = requestMeta(req);
    await logAction({
      userId: currentUser?.userId ?? null,
      action: 'analyze_influencer',
      entityType: 'influencer',
      entityId: params.id,
      brandId: influencer.brandId,
      ip,
      userAgent,
    });

    return NextResponse.json({ id: params.id, persona: updated?.persona });
  } catch (err) {
    console.error('[api/influencers/analyze]', err);
    return NextResponse.json(
      {
        error: '페르소나 분석 중 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
