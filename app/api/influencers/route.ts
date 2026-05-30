import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getBrand } from '@/lib/db/repositories/brands';
import { createInfluencer } from '@/lib/db/repositories/influencers';
import { fetchYouTubeProfile, YouTubeFetchError } from '@/lib/social/youtube';
import { generatePersona } from '@/lib/influencer/persona';
import type { SocialProfile } from '@/lib/social/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  brandId: z.string().uuid(),
  platform: z.enum(['youtube', 'instagram', 'tiktok']),
  source: z.enum(['youtube', 'manual']),
  // youtube
  input: z.string().optional(), // 핸들/URL
  // manual
  handle: z.string().optional(),
  displayName: z.string().optional(),
  url: z.string().optional(),
  bio: z.string().optional(),
  followerCount: z.number().int().nonnegative().optional(),
  posts: z
    .array(
      z.object({
        title: z.string().optional(),
        caption: z.string().optional(),
        tags: z.array(z.string()).optional(),
        url: z.string().optional(),
        publishedAt: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const brand = await getBrand(data.brandId);
    if (!brand) {
      return NextResponse.json(
        { error: `브랜드를 찾을 수 없습니다: ${data.brandId}` },
        { status: 404 }
      );
    }

    // 1) SocialProfile 확보 (youtube 자동 / manual)
    let profile: SocialProfile;
    if (data.source === 'youtube') {
      if (!data.input?.trim()) {
        return NextResponse.json(
          { error: 'youtube 소스는 input(핸들/URL)이 필요합니다.' },
          { status: 400 }
        );
      }
      try {
        profile = await fetchYouTubeProfile(data.input.trim());
      } catch (err) {
        if (err instanceof YouTubeFetchError) {
          return NextResponse.json(
            { error: err.message, fallback: 'manual' },
            { status: 502 }
          );
        }
        throw err;
      }
    } else {
      if (!data.handle?.trim()) {
        return NextResponse.json(
          { error: 'manual 소스는 handle 이 필요합니다.' },
          { status: 400 }
        );
      }
      profile = {
        platform: data.platform,
        handle: data.handle.trim(),
        displayName: data.displayName,
        url: data.url,
        bio: data.bio,
        followerCount: data.followerCount,
        posts: data.posts ?? [],
        source: 'manual',
        fetchedAt: new Date().toISOString(),
      };
    }

    // 2) 페르소나 분석 (best-effort)
    let persona: Record<string, unknown> | null = null;
    const apiKey = process.env.CLAUDE_ADMIN_KEY;
    if (apiKey && profile.posts.length > 0) {
      try {
        persona = (await generatePersona(profile, apiKey)) as Record<
          string,
          unknown
        >;
      } catch (err) {
        console.warn('[influencers] persona skipped:', err);
      }
    }

    const currentUser = await getCurrentUser();

    const saved = await createInfluencer({
      brandId: brand.id,
      platform: data.platform,
      handle: profile.handle,
      displayName: profile.displayName,
      url: profile.url,
      followerCount: profile.followerCount,
      profile: profile as unknown as Record<string, unknown>,
      persona,
      createdById: currentUser?.userId ?? null,
    });

    const { ip, userAgent } = requestMeta(req);
    await logAction({
      userId: currentUser?.userId ?? null,
      action: 'create_influencer',
      entityType: 'influencer',
      entityId: saved.id,
      brandId: brand.id,
      metadata: {
        platform: data.platform,
        handle: profile.handle,
        source: profile.source,
        posts: profile.posts.length,
        personaGenerated: Boolean(persona),
      },
      ip,
      userAgent,
    });

    return NextResponse.json({
      id: saved.id,
      brandId: brand.id,
      platform: saved.platform,
      handle: saved.handle,
      displayName: saved.displayName,
      followerCount: saved.followerCount,
      personaGenerated: Boolean(persona),
      postsCollected: profile.posts.length,
    });
  } catch (err) {
    console.error('[api/influencers]', err);
    return NextResponse.json(
      {
        error: '인플루언서 등록 중 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
