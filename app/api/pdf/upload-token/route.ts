import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getBrand } from '@/lib/db/repositories/brands';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload is JSON string we pass from client with { brandId }
        const payload = clientPayload
          ? (JSON.parse(clientPayload) as { brandId?: string })
          : {};
        if (!payload.brandId) {
          throw new Error('brandId required');
        }
        const brand = await getBrand(payload.brandId);
        if (!brand) throw new Error('brand not found');
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          // tokenPayload는 onUploadCompleted 콜백으로 그대로 전달됨
          tokenPayload: JSON.stringify({ brandId: brand.id }),
        };
      },
      onUploadCompleted: async () => {
        // Blob 업로드 완료 — 우리는 클라이언트가 /api/pdf/import 를 별도로
        // 호출해 파싱/구조화하므로 여기서는 별도 작업 없음
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error('[api/pdf/upload-token]', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
