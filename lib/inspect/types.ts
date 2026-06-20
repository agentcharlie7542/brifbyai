/**
 * 상세페이지 검수(Page Inspector) 공용 타입.
 *
 * 데이터 흐름:
 *   큐텐 URL/업로드 이미지 → 캡쳐 → Vision OCR(OcrBlock[]) → validate()(기존 엔진)
 *   → InspectBlock(블록별 findings) → InspectResult
 *
 * 약기법 판정 타입(YakkihouFinding 등)은 기존 lib/yakkihou 를 그대로 재사용한다.
 */
import type { ProductCategory, YakkihouFinding, YakkihouLevel } from '@/lib/yakkihou/types';

/** 이미지 내 정규화 좌표(0~1). 좌상단 기준. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 검수 대상 이미지(스크린샷 타일 또는 업로드 이미지). */
export interface ScanImage {
  /** data URL (image/jpeg). 무상태 MVP 이므로 Blob 없이 바로 화면에 렌더. */
  dataUrl: string;
  width: number;
  height: number;
}

/** Vision OCR 이 인식한 텍스트 블록(읽기순서 보존). */
export interface OcrBlock {
  imageIndex: number;
  text: string;
  bbox: BBox;
}

/** OCR 블록 + 해당 블록 텍스트에 대한 약기법 판정 결과. */
export interface InspectBlock {
  imageIndex: number;
  text: string;
  bbox: BBox;
  /** startIndex/endIndex 는 이 블록 text 기준(0-based) 오프셋. */
  findings: YakkihouFinding[];
  /** 블록 전체의 대표 레벨(박스 색상용). findings 중 최고 위험도. */
  level: YakkihouLevel;
}

export interface InspectResult {
  /** URL 모드면 출처, 업로드 모드면 null. */
  source: { url: string; productId: string } | null;
  category: ProductCategory;
  images: ScanImage[];
  blocks: InspectBlock[];
  summary: { safe: number; warn: number; ng: number };
  /** 계측: 캡쳐 방식·이미지 수·블록 수. */
  meta: {
    capture: 'screenshot' | 'upload';
    imageCount: number;
    blockCount: number;
    layer3: boolean;
  };
}

export type { ProductCategory, YakkihouFinding, YakkihouLevel };
