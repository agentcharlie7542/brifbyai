import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSheet, updateSheet, deleteSheet } from '@/lib/db/repositories/sheets';
import { validate } from '@/lib/yakkihou/validator';
import { flattenSheetText } from '@/lib/sheet/generator';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
import type { ProductCategory } from '@/lib/yakkihou/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

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
          console.warn('[sheets/PATCH] yakkihou validate skipped:', err);
        }
      } else {
        yakkihouSummary = { safe: 0, warn: 0, ng: 0, findings: [] };
      }
    }

    const currentUser = await getCurrentUser();

    const updated = await updateSheet(params.id, {
      content: nextContent as Record<string, unknown>,
      campaignName: parsed.data.campaignName ?? existing.campaignName,
      category: nextCategory,
      yakkihouSummary,
      updatedById: currentUser?.userId ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }

    const { ip, userAgent } = requestMeta(req);
    await logAction({
      userId: currentUser?.userId ?? null,
      action: 'update_sheet',
      entityType: 'sheet',
      entityId: updated.id,
      brandId: existing.brandId,
      metadata: {
        revalidated: Boolean(contentChanged || categoryChanged),
        category: nextCategory,
      },
      ip,
      userAgent,
    });

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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    // viewer 는 삭제 불가 — editor/admin 만.
    if (!currentUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (currentUser.role === 'viewer') {
      return NextResponse.json(
        { error: 'viewer 권한으로는 시트를 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 삭제 전 메타 (audit log 용 — 삭제 후엔 못 읽음)
    const existing = await getSheet(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const deleted = await deleteSheet(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'delete failed' }, { status: 500 });
    }

    const { ip, userAgent } = requestMeta(req);
    await logAction({
      userId: currentUser.userId,
      action: 'delete_sheet',
      entityType: 'sheet',
      entityId: deleted.id,
      brandId: deleted.brandId,
      metadata: {
        campaignName: existing.campaignName,
        category: existing.category,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ id: deleted.id, deleted: true });
  } catch (err) {
    console.error('[api/sheets/DELETE]', err);
    return NextResponse.json(
      {
        error: '시트 삭제 중 오류가 발생했습니다.',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
