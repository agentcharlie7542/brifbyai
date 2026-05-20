import { NextResponse } from 'next/server';
import { z } from 'zod';

import { parseAndStructurePdf } from '@/lib/pdf-parser';
import {
  ensureSeedBrands,
  getBrand,
  saveReferenceSheet,
} from '@/lib/storage/local';

export const runtime = 'nodejs';
// PDF + Claude 라운드트립이 길어질 수 있어 한도 늘림.
export const maxDuration = 60;

const FormSchema = z.object({
  brandId: z.string().min(1),
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

    const form = await req.formData();
    const parsed = FormSchema.safeParse({ brandId: form.get('brandId') });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'brandId 가 누락되었습니다.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await ensureSeedBrands();
    const brand = await getBrand(parsed.data.brandId);
    if (!brand) {
      return NextResponse.json(
        { error: `브랜드를 찾을 수 없습니다: ${parsed.data.brandId}` },
        { status: 404 }
      );
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'file 필드에 PDF 가 없습니다.' },
        { status: 400 }
      );
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: `지원하지 않는 파일 형식: ${file.type}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rawText, pages, structured } = await parseAndStructurePdf(
      buffer,
      apiKey
    );

    const saved = await saveReferenceSheet({
      brandId: brand.id,
      fileName: file.name,
      pdfBytes: buffer,
      parsedText: rawText,
      structured,
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
