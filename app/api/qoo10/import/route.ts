import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseQoo10Url } from '@/lib/qoo10/url';
import {
  fetchProductHtml,
  fetchProductTier2,
  Qoo10FetchError,
  isQueueArtifactTitle,
} from '@/lib/qoo10/fetcher';
import { parseQoo10Html } from '@/lib/qoo10/parser';
import { getCached, saveCached, deleteCached } from '@/lib/qoo10/cache';
import type { Qoo10ProductData } from '@/lib/qoo10/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';
// Tier 2(헤드리스 브라우저 + Queue-it 대기열 통과)까지 고려해 여유를 둠
export const maxDuration = 60;

const Body = z.object({
  url: z.string().min(1),
  /** true면 캐시 무시하고 Qoo10 다시 fetch */
  forceRefresh: z.boolean().optional(),
  /** Tier 3 수동 폴백: 클라이언트에서 직접 입력한 데이터 전달 */
  manual: z
    .object({
      title: z.string(),
      price: z.number().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
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

    const parsedUrl = parseQoo10Url(parsed.data.url);
    if (!parsedUrl) {
      return NextResponse.json(
        {
          error:
            'Qoo10 URL 형식이 아닙니다. 예: https://www.qoo10.jp/g/1031167095',
        },
        { status: 400 }
      );
    }

    // 캐시 우선
    if (!parsed.data.forceRefresh && !parsed.data.manual) {
      const cached = await getCached(parsedUrl.productId);
      if (cached) {
        // 과거에 Queue-it 대기열 페이지가 "Queue-it" 상품으로 잘못 캐시된 잔재는 무시·삭제
        if (isQueueArtifactTitle(cached.title) && cached.fetchMethod !== 'tier3_manual') {
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
        price:
          parsed.data.manual.price != null
            ? { current: parsed.data.manual.price, currency: 'JPY' }
            : undefined,
        fetchedAt: new Date().toISOString(),
        fetchMethod: 'tier3_manual',
      };
      await saveCached(product);
      return NextResponse.json({ product, cached: false });
    }

    // Tier 1 → (대기열이면) Tier 2 폴백
    try {
      let html: string;
      let tier: 'tier1' | 'tier2';
      try {
        ({ html } = await fetchProductHtml(parsedUrl.url));
        tier = 'tier1';
      } catch (tier1Err) {
        // Tier 1 이 Queue-it 대기열에 막힌 경우에만 헤드리스 브라우저로 재시도
        if (tier1Err instanceof Qoo10FetchError && tier1Err.kind === 'queued') {
          ({ html } = await fetchProductTier2(parsedUrl.url));
          tier = 'tier2';
        } else {
          throw tier1Err;
        }
      }

      const product = parseQoo10Html(html, parsedUrl.productId, parsedUrl.url);
      product.fetchMethod = tier;
      // 비정상 응답(타이틀 없음 / Queue-it 대기열 잔재) 도 사용자에게 실패 신호 — 캐시 저장 안 함
      if (isQueueArtifactTitle(product.title)) {
        return NextResponse.json(
          {
            error:
              'Qoo10 페이지에서 상품명을 추출하지 못했습니다. 수동 입력 폴백을 사용하세요.',
            tier: 'tier1',
          },
          { status: 422 }
        );
      }
      await saveCached(product);
      const currentUser = await getCurrentUser();
      const { ip, userAgent } = requestMeta(req);
      await logAction({
        userId: currentUser?.userId ?? null,
        action: 'qoo10_import',
        metadata: { productId: product.productId, title: product.title },
        ip,
        userAgent,
      });
      return NextResponse.json({ product, cached: false });
    } catch (err) {
      if (err instanceof Qoo10FetchError) {
        if (err.kind === 'queued') {
          return NextResponse.json(
            {
              error:
                'Qoo10 가 Queue-it 대기열(봇 차단)을 적용 중이라 자동 수집이 막혔습니다. 잠시 후 다시 시도하거나 수동 입력 폴백을 사용하세요.',
              detail: err.message,
              tier: 'tier1',
              queued: true,
            },
            { status: 503 }
          );
        }
        return NextResponse.json(
          {
            error: 'Qoo10 fetch 실패. 수동 입력 폴백을 사용하세요.',
            detail: err.message,
            status: err.status,
            tier: 'tier1',
          },
          { status: err.status === 403 || err.status === 429 ? err.status : 502 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error('[api/qoo10/import]', err);
    return NextResponse.json(
      { error: 'qoo10 import failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
