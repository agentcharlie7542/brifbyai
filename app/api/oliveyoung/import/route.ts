import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseOliveYoungUrl } from '@/lib/oliveyoung/url';
import {
  fetchProductHtml,
  fetchProductTier2,
  OliveYoungFetchError,
  isWallArtifactTitle,
} from '@/lib/oliveyoung/fetcher';
import { parseOliveYoungHtml } from '@/lib/oliveyoung/parser';
import { getCached, saveCached, deleteCached } from '@/lib/qoo10/cache';
import type { Qoo10ProductData } from '@/lib/qoo10/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';
// Tier 2 (헤드리스 브라우저 + 봇 차단 통과) 까지 고려해 여유를 둠
export const maxDuration = 60;

const Body = z.object({
  url: z.string().min(1),
  /** true 면 캐시 무시하고 올리브영 다시 fetch */
  forceRefresh: z.boolean().optional(),
  /** Tier 3 수동 폴백: 클라이언트에서 직접 입력한 데이터 전달 */
  manual: z
    .object({
      title: z.string(),
      price: z.number().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const parsedUrl = parseOliveYoungUrl(parsed.data.url);
    if (!parsedUrl) {
      return NextResponse.json(
        {
          error:
            '올리브영 URL 형식이 아닙니다. 예: https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000247884',
        },
        { status: 400 }
      );
    }

    // 캐시 우선 (Qoo10 와 캐시 디렉터리 공유 — productId 가 다른 형태라 충돌 없음)
    if (!parsed.data.forceRefresh && !parsed.data.manual) {
      const cached = await getCached(parsedUrl.productId);
      if (cached) {
        // 과거 wall 페이지가 잘못 캐시된 잔재면 무시·삭제
        if (
          isWallArtifactTitle(cached.title) &&
          cached.fetchMethod !== 'tier3_manual'
        ) {
          await deleteCached(parsedUrl.productId);
        } else {
          return NextResponse.json({ product: cached, cached: true });
        }
      }
    }

    // Tier 3 (수동 입력) — fetch 우회
    if (parsed.data.manual) {
      const product: Qoo10ProductData = {
        url: parsedUrl.url,
        productId: parsedUrl.productId,
        title: parsed.data.manual.title,
        description: parsed.data.manual.description,
        category: parsed.data.manual.category,
        brand: parsed.data.manual.brand,
        price:
          parsed.data.manual.price != null
            ? { current: parsed.data.manual.price, currency: 'KRW' }
            : undefined,
        fetchedAt: new Date().toISOString(),
        fetchMethod: 'tier3_manual',
        source: 'oliveyoung',
      };
      await saveCached(product);
      return NextResponse.json({ product, cached: false });
    }

    // Tier 1 → (봇 차단이면) Tier 2 폴백
    try {
      let html: string;
      let tier: 'tier1' | 'tier2';
      try {
        ({ html } = await fetchProductHtml(parsedUrl.url));
        tier = 'tier1';
      } catch (tier1Err) {
        // 올리브영은 거의 항상 wall 이라 Tier 2 로 빠짐
        if (
          tier1Err instanceof OliveYoungFetchError &&
          (tier1Err.kind === 'wall' || tier1Err.kind === 'empty')
        ) {
          ({ html } = await fetchProductTier2(parsedUrl.url));
          tier = 'tier2';
        } else {
          throw tier1Err;
        }
      }

      const product = parseOliveYoungHtml(html, parsedUrl.productId, parsedUrl.url);
      product.fetchMethod = tier;
      // 비정상 응답(타이틀 없음 / wall 잔재) 도 사용자에게 실패 신호 — 캐시 저장 안 함
      if (!product.title || isWallArtifactTitle(product.title)) {
        return NextResponse.json(
          {
            error:
              '올리브영 페이지에서 상품명을 추출하지 못했습니다. 수동 입력 폴백을 사용하세요.',
            tier,
          },
          { status: 422 }
        );
      }
      await saveCached(product);
      const currentUser = await getCurrentUser();
      const { ip, userAgent } = requestMeta(req);
      await logAction({
        userId: currentUser?.userId ?? null,
        action: 'oliveyoung_import',
        metadata: { productId: product.productId, title: product.title },
        ip,
        userAgent,
      });
      return NextResponse.json({ product, cached: false });
    } catch (err) {
      if (err instanceof OliveYoungFetchError) {
        if (err.kind === 'wall') {
          return NextResponse.json(
            {
              error:
                '올리브영 봇 차단(잠시만 기다려 주세요)으로 자동 수집이 막혔습니다. 잠시 후 다시 시도하거나 수동 입력 폴백을 사용하세요.',
              detail: err.message,
              tier: err.tier,
              wall: true,
            },
            { status: 503 }
          );
        }
        return NextResponse.json(
          {
            error: '올리브영 fetch 실패. 수동 입력 폴백을 사용하세요.',
            detail: err.message,
            status: err.status,
            tier: err.tier,
          },
          {
            status:
              err.status === 403 || err.status === 429 ? err.status : 502,
          }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error('[api/oliveyoung/import]', err);
    return NextResponse.json(
      { error: 'oliveyoung import failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
