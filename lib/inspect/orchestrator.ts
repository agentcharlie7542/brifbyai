/**
 * 상세페이지 검수 파이프라인 결합.
 *
 *   ScanImage[] ─ ocrImage(병렬) ─ OcrBlock[] ─ validate(블록별) ─ InspectBlock[] ─ InspectResult
 *
 * 약기법 판정은 기존 엔진 validate() 만 호출(이 파일에 룰/판정 로직 없음).
 * 블록 단위로 검사하므로 finding 의 startIndex/endIndex 는 "그 블록 텍스트" 기준 오프셋이고,
 * 화면에서 텍스트 하이라이트(블록 내) + 이미지 박스(블록 bbox)에 그대로 매핑된다.
 */
import { validate } from '@/lib/yakkihou/validator';
import { ocrImage, type OcrMediaType } from '@/lib/ocr/vision';
import type {
  InspectBlock,
  InspectResult,
  ProductCategory,
  ScanImage,
  YakkihouLevel,
} from './types';

export interface InspectOptions {
  images: ScanImage[];
  category: ProductCategory;
  capture: 'screenshot' | 'upload';
  source?: { url: string; productId: string } | null;
  apiKey?: string;
  /** Layer 3(Claude 판정) 비활성화. 기본 true(룰셋만 — 빠르고 무료). */
  skipLayer3?: boolean;
  modelOverride?: string;
  /**
   * 마감 시각(epoch ms). Vercel Hobby 의 60s 함수 한도 안에 반드시 JSON 을 돌려주기 위해,
   * 이 시각이 가까워지면 남은 OCR 을 건너뛰고(부분 결과), L3 판정을 먼저 끈다.
   * 미지정이면 시간 가드 없이 전부 처리.
   */
  deadlineAt?: number;
}

const OCR_CONCURRENCY = 6;
/** OCR 은 마감 이만큼 전에 멈춘다(검증·직렬화 여유). */
const OCR_RESERVE_MS = 8_000;
/** 마감 이만큼 전부터는 L3(Claude) 를 끄고 룰셋만으로 판정. */
const L3_RESERVE_MS = 4_000;

function mediaTypeOf(dataUrl: string): OcrMediaType {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,/i);
  return (m?.[1].toLowerCase() as OcrMediaType) ?? 'image/jpeg';
}

function maxLevel(levels: YakkihouLevel[]): YakkihouLevel {
  if (levels.includes('NG')) return 'NG';
  if (levels.includes('WARN')) return 'WARN';
  return 'SAFE';
}

/** 간단한 동시성 제한 map. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runInspect(opts: InspectOptions): Promise<InspectResult> {
  const skipLayer3 = opts.skipLayer3 ?? true;
  const deadlineAt = opts.deadlineAt;
  // 마감이 가까워 OCR 을 건너뛴 이미지 인덱스(부분 검수 표기용).
  const pendingImages: number[] = [];

  // ── 1) 이미지별 OCR (병렬) ──────────────────────────────
  const ocrPerImage = await mapPool(opts.images, OCR_CONCURRENCY, async (img, idx) => {
    if (!opts.apiKey) return [];
    // 시간 예산 초과 → 이 이미지는 OCR 건너뛰고 "미검수"로 보고(조용한 누락 방지).
    if (deadlineAt && Date.now() > deadlineAt - OCR_RESERVE_MS) {
      pendingImages.push(idx);
      return [];
    }
    try {
      const blocks = await ocrImage(
        { base64: img.dataUrl, mediaType: mediaTypeOf(img.dataUrl) },
        opts.apiKey,
        opts.modelOverride
      );
      return blocks.map((b) => ({ ...b, imageIndex: idx }));
    } catch (err) {
      console.warn(
        `[inspect] OCR 실패 (image ${idx}):`,
        err instanceof Error ? err.message : err
      );
      return [];
    }
  });
  const ocrBlocks = ocrPerImage.flat();

  // ── 2) 블록별 약기법 검증 ───────────────────────────────
  const inspectBlocks = await mapPool(ocrBlocks, OCR_CONCURRENCY, async (block) => {
    // 마감 임박 시 L3(Claude) 를 먼저 끄고 룰셋만으로 — 함수 한도 초과(크래시) 회피.
    const blockSkipLayer3 =
      skipLayer3 || (deadlineAt ? Date.now() > deadlineAt - L3_RESERVE_MS : false);
    const res = await validate({
      text: block.text,
      category: opts.category,
      apiKey: opts.apiKey,
      skipLayer3: blockSkipLayer3,
      modelOverride: opts.modelOverride,
    });
    const ib: InspectBlock = {
      imageIndex: block.imageIndex,
      text: block.text,
      bbox: block.bbox,
      findings: res.findings,
      level: maxLevel(res.findings.map((f) => f.level)),
    };
    return ib;
  });

  // ── 3) 요약 집계 ────────────────────────────────────────
  let warn = 0;
  let ng = 0;
  let safeBlocks = 0;
  for (const b of inspectBlocks) {
    warn += b.findings.filter((f) => f.level === 'WARN').length;
    ng += b.findings.filter((f) => f.level === 'NG').length;
    if (b.findings.length === 0) safeBlocks += 1;
  }

  return {
    source: opts.source ?? null,
    category: opts.category,
    images: opts.images,
    blocks: inspectBlocks,
    summary: { safe: safeBlocks, warn, ng },
    meta: {
      capture: opts.capture,
      imageCount: opts.images.length,
      blockCount: inspectBlocks.length,
      layer3: !skipLayer3,
      partial: pendingImages.length > 0,
      pendingImages: pendingImages.sort((a, b) => a - b),
    },
  };
}
