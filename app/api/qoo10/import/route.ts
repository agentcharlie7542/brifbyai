import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseQoo10Url } from '@/lib/qoo10/url';
import { fetchProductHtml, Qoo10FetchError } from '@/lib/qoo10/fetcher';
import { parseQoo10Html } from '@/lib/qoo10/parser';
import { getCached, saveCached } from '@/lib/qoo10/cache';
import type { Qoo10ProductData } from '@/lib/qoo10/types';

export const runtime = 'nodejs';
export const maxDuration = 45;

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
        return NextResponse.json({ product: cached, cached: true });
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

    // Tier 1
    try {
      const { html } = await fetchProductHtml(parsedUrl.url);
      const product = parseQoo10Html(html, parsedUrl.productId, parsedUrl.url);
      // 비정상 응답(타이틀 없음) 도 사용자에게 실패 신호
      if (!product.title) {
        return NextResponse.json(
          {
            error: 'Qoo10 페이지에서 상품명을 추출하지 못했습니다. 수동 입력 폴백을 사용하세요.',
            tier: 'tier1',
          },
          { status: 422 }
        );
      }
      await saveCached(product);
      return NextResponse.json({ product, cached: false });
    } catch (err) {
      if (err instanceof Qoo10FetchError) {
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
