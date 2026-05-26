import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getBrand } from '@/lib/db/repositories/brands';
import { listReferenceSheetsByBrand } from '@/lib/db/repositories/reference-sheets';
import { createSheet } from '@/lib/db/repositories/sheets';
import { parseQoo10Url } from '@/lib/qoo10/url';
import { getCached, saveCached } from '@/lib/qoo10/cache';
import { fetchProductHtml, Qoo10FetchError } from '@/lib/qoo10/fetcher';
import { parseQoo10Html } from '@/lib/qoo10/parser';
import type { Qoo10ProductData } from '@/lib/qoo10/types';
import { generateSheet, flattenSheetText } from '@/lib/sheet/generator';
import { validate } from '@/lib/yakkihou/validator';
import type { ProductCategory } from '@/lib/yakkihou/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PRODUCT_CATEGORIES = [
  'cosmetic',
  'quasi_drug',
  'health_food',
  'functional_food',
  'general_food',
  'medical_device',
  'general',
] as const;

const TARGET_MARKETS = ['jp', 'kr', 'global'] as const;

const Body = z.object({
  brandId: z.string().uuid(),
  qoo10Url: z.string().min(1),
  category: z.enum(PRODUCT_CATEGORIES),
  campaignName: z.string().min(1).max(256).optional(),
});

async function getProduct(rawUrl: string): Promise<Qoo10ProductData> {
  const parsed = parseQoo10Url(rawUrl);
  if (!parsed) {
    throw new Error('Qoo10 URL 형식이 아닙니다.');
  }
  const cached = await getCached(parsed.productId);
  if (cached) return cached;

  const { html } = await fetchProductHtml(parsed.url);
  const product = parseQoo10Html(html, parsed.productId, parsed.url);
  if (!product.title) {
    throw new Error('Qoo10 페이지에서 상품명을 추출하지 못했습니다.');
  }
  await saveCached(product);
  return product;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.CLAUDE_ADMIN_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CLAUDE_ADMIN_KEY 환경변수가 설정되지 않았습니다.' },
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

    const brand = await getBrand(parsed.data.brandId);
    if (!brand) {
      return NextResponse.json(
        { error: `브랜드를 찾을 수 없습니다: ${parsed.data.brandId}` },
        { status: 404 }
      );
    }

    let product: Qoo10ProductData;
    try {
      product = await getProduct(parsed.data.qoo10Url);
    } catch (err) {
      if (err instanceof Qoo10FetchError) {
        return NextResponse.json(
          {
            error: 'Qoo10 fetch 실패. 수동 입력 폴백 후 재시도하세요.',
            detail: err.message,
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 }
      );
    }

    const refs = await listReferenceSheetsByBrand(brand.id);
    const references = refs.slice(0, 3).map((r) => ({
      fileName: r.fileName,
      structured: r.structured ?? null,
    }));

    const sheet = await generateSheet(
      {
        product,
        brand: {
          name: brand.name,
          nameJa: brand.nameJa,
          defaultTone: brand.defaultTone,
          defaultMarket: brand.defaultMarket,
        },
        references,
        category: parsed.data.category as ProductCategory,
        campaignName: parsed.data.campaignName,
      },
      apiKey
    );

    // 약기법 검증 — sentenceHints 가 아닌 실제 본문 텍스트 기준
    const flatText = flattenSheetText(sheet);
    let yakkihouSummary: { safe: number; warn: number; ng: number } | null = null;
    if (flatText.trim()) {
      try {
        const v = await validate({
          text: flatText,
          category: parsed.data.category as ProductCategory,
          apiKey,
          // 시트 생성과 검증 합산 60s 안에 끝나야 함 — Layer 3 는 끔
          skipLayer3: true,
        });
        yakkihouSummary = v.summary;
      } catch (err) {
        console.warn('[sheets/generate] yakkihou validate skipped:', err);
      }
    }

    const campaignName =
      parsed.data.campaignName?.trim() ||
      sheet.campaign?.name?.trim() ||
      product.title.slice(0, 80);

    const targetMarket = ((): (typeof TARGET_MARKETS)[number] => {
      const m = sheet.product?.targetMarket;
      if (m && (TARGET_MARKETS as readonly string[]).includes(m)) {
        return m as (typeof TARGET_MARKETS)[number];
      }
      const b = brand.defaultMarket;
      if ((TARGET_MARKETS as readonly string[]).includes(b)) {
        return b as (typeof TARGET_MARKETS)[number];
      }
      return 'jp';
    })();

    const saved = await createSheet({
      brandId: brand.id,
      campaignName,
      targetMarket,
      category: parsed.data.category as ProductCategory,
      content: sheet as Record<string, unknown>,
      yakkihouSummary,
    });

    return NextResponse.json({
      id: saved.id,
      brandId: brand.id,
      campaignName: saved.campaignName,
      yakkihouSummary,
    });
  } catch (err) {
    console.error('[api/sheets/generate]', err);
    return NextResponse.json(
      {
        error: '시트 생성 중 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
