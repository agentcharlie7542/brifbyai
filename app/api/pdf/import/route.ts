import { NextResponse } from 'next/server';
import { z } from 'zod';

import { parseAndStructurePdf } from '@/lib/pdf-parser';
import { getBrand } from '@/lib/db/repositories/brands';
import { createReferenceSheet } from '@/lib/db/repositories/reference-sheets';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  brandId: z.string().uuid(),
  blobUrl: z.string().url(),
  fileName: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  try {
    const apiKey = process.env.CLAUDE_ADMIN_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CLAUDE_ADMIN_KEY 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const raw = await req.json();
    const parsed = Body.safeParse(raw);
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

    // PDF 바이트는 함수가 아니라 Vercel Blob 에 직접 업로드되어 있으므로
    // 여기서는 Blob 에서 받아와 파싱만 한다.
    const res = await fetch(parsed.data.blobUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Blob 에서 PDF 를 가져오지 못했습니다 (HTTP ${res.status})` },
        { status: 502 }
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const { rawText, pages, structured } = await parseAndStructurePdf(
      buffer,
      apiKey
    );

    const saved = await createReferenceSheet({
      brandId: brand.id,
      fileName: parsed.data.fileName,
      storageUrl: parsed.data.blobUrl,
      parsedText: rawText,
      structured: structured as Record<string, unknown>,
      pages,
    });

    return NextResponse.json({
      id: saved.id,
      fileName: saved.fileName,
      pages: saved.pages,
      brand: { id: brand.id, name: brand.name },
      structuredPreview: structured,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/pdf/import]', err);
    return NextResponse.json(
      { error: 'PDF 처리 중 오류가 발생했습니다.', detail: message },
      { status: 500 }
    );
  }
}
