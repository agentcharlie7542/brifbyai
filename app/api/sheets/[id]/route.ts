import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSheet, updateSheet } from '@/lib/db/repositories/sheets';
import { validate } from '@/lib/yakkihou/validator';
import { flattenSheetText } from '@/lib/sheet/generator';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
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

const PatchBody = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  campaignName: z.string().min(1).max(256).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sheet = await getSheet(params.id);
  if (!sheet) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ sheet });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await getSheet(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const nextContent = (parsed.data.content ??
      existing.content) as StructuredOrientSheet;
    const nextCategory = (parsed.data.category ?? existing.category) as ProductCategory;

    // 콘텐츠 또는 카테고리가 변경되면 약기법 재검증
    const contentChanged =
      parsed.data.content &&
      JSON.stringify(parsed.data.content) !== JSON.stringify(existing.content);
    const categoryChanged =
      parsed.data.category && parsed.data.category !== existing.category;

    let yakkihouSummary = existing.yakkihouSummary;
    if (contentChanged || categoryChanged) {
      const apiKey = process.env.CLAUDE_ADMIN_KEY;
      const flat = flattenSheetText(nextContent);
      if (flat.trim()) {
        try {
          const v = await validate({
            text: flat,
            category: nextCategory,
            apiKey,
            skipLayer3: true,
          });
          yakkihouSummary = v.summary;
        } catch (err) {
          console.warn('[sheets/PATCH] yakkihou validate skipped:', err);
        }
      } else {
        yakkihouSummary = { safe: 0, warn: 0, ng: 0 };
      }
    }

    const updated = await updateSheet(params.id, {
      content: nextContent as Record<string, unknown>,
      campaignName: parsed.data.campaignName ?? existing.campaignName,
      category: nextCategory,
      yakkihouSummary,
    });

    if (!updated) {
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }

    return NextResponse.json({
      id: updated.id,
      campaignName: updated.campaignName,
      category: updated.category,
      yakkihouSummary: updated.yakkihouSummary,
      revalidated: Boolean(contentChanged || categoryChanged),
    });
  } catch (err) {
    console.error('[api/sheets/PATCH]', err);
    return NextResponse.json(
      {
        error: '시트 수정 중 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
