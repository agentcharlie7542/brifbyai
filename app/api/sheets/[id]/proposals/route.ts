import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSheet } from '@/lib/db/repositories/sheets';
import {
  getInfluencer,
  createProposal,
} from '@/lib/db/repositories/influencers';
import { generateProposal } from '@/lib/influencer/proposal';
import { generatePersona } from '@/lib/influencer/persona';
import { flattenSheetText } from '@/lib/sheet/generator';
import { validate } from '@/lib/yakkihou/validator';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
import type { InfluencerPersona } from '@/lib/influencer/persona';
import type { SocialProfile } from '@/lib/social/types';
import type { ProductCategory } from '@/lib/yakkihou/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  influencerId: z.string().uuid(),
});

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

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const sheet = await getSheet(params.id);
    if (!sheet) {
      return NextResponse.json({ error: '시트를 찾을 수 없습니다.' }, { status: 404 });
    }
    const influencer = await getInfluencer(parsed.data.influencerId);
    if (!influencer) {
      return NextResponse.json(
        { error: '인플루언서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    if (influencer.brandId !== sheet.brandId) {
      return NextResponse.json(
        { error: '시트와 인플루언서의 브랜드가 다릅니다.' },
        { status: 400 }
      );
    }

    // 페르소나 확보 (없으면 프로필로 즉석 분석)
    let persona = influencer.persona as unknown as InfluencerPersona | null;
    if (!persona) {
      const profile = influencer.profile as unknown as SocialProfile | null;
      if (profile && profile.posts && profile.posts.length > 0) {
        try {
          persona = await generatePersona(profile, apiKey);
        } catch {
          persona = null;
        }
      }
    }
    if (!persona) {
      return NextResponse.json(
        {
          error:
            '인플루언서 페르소나가 없습니다. 게시물 추가 후 분석을 먼저 실행하세요.',
        },
        { status: 400 }
      );
    }

    const proposal = await generateProposal(
      {
        sheet: sheet.content as StructuredOrientSheet,
        sheetCategory: sheet.category,
        persona,
        influencer: {
          platform: influencer.platform,
          handle: influencer.handle,
          displayName: influencer.displayName ?? undefined,
          followerCount: influencer.followerCount ?? undefined,
        },
      },
      apiKey
    );

    // 약기법 재검증
    const flat = flattenSheetText(proposal);
    let yakkihouSummary:
      | {
          safe: number;
          warn: number;
          ng: number;
          findings?: Array<{
            text: string;
            level: 'WARN' | 'NG';
            rule: string;
            reason: string;
            suggestions: string[];
          }>;
        }
      | null = null;
    if (flat.trim()) {
      try {
        const v = await validate({
          text: flat,
          category: sheet.category as ProductCategory,
          apiKey,
          skipLayer3: true,
        });
        yakkihouSummary = {
          ...v.summary,
          findings: v.findings
            .filter((f) => f.level !== 'SAFE')
            .map((f) => ({
              text: f.text,
              level: f.level as 'WARN' | 'NG',
              rule: f.rule,
              reason: f.reason,
              suggestions: f.suggestions,
            })),
        };
      } catch (err) {
        console.warn('[proposals] yakkihou validate skipped:', err);
      }
    }

    const currentUser = await getCurrentUser();
    const saved = await createProposal({
      sheetId: sheet.id,
      influencerId: influencer.id,
      content: proposal as unknown as Record<string, unknown>,
      yakkihouSummary,
      status: 'draft',
      createdById: currentUser?.userId ?? null,
    });

    const { ip, userAgent } = requestMeta(req);
    await logAction({
      userId: currentUser?.userId ?? null,
      action: 'generate_proposal',
      entityType: 'influencer_proposal',
      entityId: saved.id,
      brandId: sheet.brandId,
      metadata: {
        sheetId: sheet.id,
        influencerId: influencer.id,
        influencer: influencer.handle,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({
      id: saved.id,
      sheetId: sheet.id,
      influencerId: influencer.id,
      yakkihouSummary,
    });
  } catch (err) {
    console.error('[api/sheets/proposals]', err);
    return NextResponse.json(
      {
        error: '맞춤 제안 생성 중 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
