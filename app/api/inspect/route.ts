import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseQoo10Url } from '@/lib/qoo10/url';
import { captureDetailImages } from '@/lib/qoo10/detail-images';
import { Qoo10FetchError } from '@/lib/qoo10/fetcher';
import { runInspect } from '@/lib/inspect/orchestrator';
import type { ScanImage } from '@/lib/inspect/types';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logAction, requestMeta } from '@/lib/audit/log';

export const runtime = 'nodejs';
// 헤드리스 캡쳐 + 다중 이미지 Vision OCR 까지 고려해 한도를 최대로.
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

const DATA_URL_RE = /^data:image\/(?:jpeg|png|webp|gif);base64,/i;

const Body = z
  .object({
    category: z.enum(PRODUCT_CATEGORIES),
    /** 자동 캡쳐 모드: 큐텐 상품 URL */
    url: z.string().min(1).optional(),
    /** 업로드 모드: 이미지 data URL 배열 */
    images: z
      .array(z.string().max(12_000_000))
      .min(1)
      .max(20)
      .optional(),
    /** Layer 3(Claude 판정) 사용 여부. 기본 false(룰셋만). */
    useClaude: z.boolean().optional(),
  })
  .refine((d) => !!d.url || (d.images?.length ?? 0) > 0, {
    message: 'url 또는 images 중 하나는 필수입니다',
  });

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { category, url, images, useClaude } = parsed.data;

    // Vercel Hobby 의 60s 함수 한도. 마감 전에 반드시 JSON(부분 결과)을 돌려주기 위한 예산.
    const startedAt = Date.now();
    const deadlineAt = startedAt + 52_000; // 직렬화·콜드스타트 여유로 8s 남김
    const captureDeadlineAt = startedAt + 28_000; // 캡쳐는 28s 안에 끝내고 OCR 에 시간 양보

    const apiKey = process.env.CLAUDE_ADMIN_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CLAUDE_ADMIN_KEY 가 설정되지 않아 OCR 을 수행할 수 없습니다.' },
        { status: 500 }
      );
    }

    let scanImages: ScanImage[];
    let source: { url: string; productId: string } | null = null;
    let capture: 'screenshot' | 'upload';

    if (url) {
      const parsedUrl = parseQoo10Url(url);
      if (!parsedUrl) {
        return NextResponse.json(
          { error: 'Qoo10 URL 형식이 아닙니다. 예: https://www.qoo10.jp/g/1031167095' },
          { status: 400 }
        );
      }
      try {
        const captured = await captureDetailImages(parsedUrl.url, {
          deadlineAt: captureDeadlineAt,
        });
        scanImages = captured.images;
      } catch (err) {
        if (err instanceof Qoo10FetchError) {
          const queued = err.kind === 'queued';
          return NextResponse.json(
            {
              error: queued
                ? 'Qoo10 자동 캡쳐가 막혔습니다(대기열/브라우저). 상세페이지를 캡쳐해 이미지 업로드 모드로 검수하세요.'
                : '상세페이지 캡쳐에 실패했습니다. 이미지 업로드 모드를 사용하세요.',
              detail: err.message,
              queued,
            },
            { status: queued ? 503 : 502 }
          );
        }
        throw err;
      }
      source = { url: parsedUrl.url, productId: parsedUrl.productId };
      capture = 'screenshot';
    } else {
      const list = images!;
      const bad = list.find((d) => !DATA_URL_RE.test(d));
      if (bad) {
        return NextResponse.json(
          { error: '이미지는 data URL(image/jpeg|png|webp) 형식이어야 합니다.' },
          { status: 400 }
        );
      }
      scanImages = list.map((dataUrl) => ({ dataUrl, width: 0, height: 0 }));
      capture = 'upload';
    }

    const result = await runInspect({
      images: scanImages,
      category,
      capture,
      source,
      apiKey,
      skipLayer3: !useClaude,
      deadlineAt,
    });

    // 감사 로그 (best-effort)
    try {
      const currentUser = await getCurrentUser();
      const { ip, userAgent } = requestMeta(req);
      await logAction({
        userId: currentUser?.userId ?? null,
        action: 'inspect_scan',
        metadata: {
          capture,
          category,
          productId: source?.productId,
          images: result.meta.imageCount,
          blocks: result.meta.blockCount,
          ng: result.summary.ng,
          warn: result.summary.warn,
        },
        ip,
        userAgent,
      });
    } catch {
      // 로깅 실패는 응답을 막지 않음
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/inspect]', err);
    return NextResponse.json(
      { error: 'inspect failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
