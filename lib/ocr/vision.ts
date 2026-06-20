/**
 * Claude Vision OCR — 이미지 1장에서 텍스트 블록 + 정규화 bbox 추출.
 *
 * Qoo10 상세페이지는 카피가 이미지에 박혀 있어 HTML 텍스트로는 안 읽힌다.
 * 이 모듈이 이미지를 읽어 "블록(한 문장/한 묶음) + 화면 좌표"로 환원하면,
 * 그 텍스트를 기존 약기법 엔진 validate() 가 그대로 검사한다.
 *
 * - 한 이미지 = 한 번의 Claude 호출 (호출자가 타일별로 병렬 호출)
 * - 좌표는 0~1 정규화(좌상단 기준) — 이미지 표시 크기와 무관하게 오버레이 가능
 * - 약기법 판정은 절대 여기서 하지 않는다(OCR 전용). 판정은 lib/yakkihou 로만.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { OcrBlock } from '@/lib/inspect/types';

export type OcrMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface OcrImageInput {
  /** raw base64 또는 data URL 둘 다 허용(접두사 자동 제거). */
  base64: string;
  mediaType: OcrMediaType;
}

const SYSTEM = `あなたは画像から日本語テキストを正確に抽出するOCRエンジンです。

入力された商品詳細ページ画像から、広告・宣伝コピーのテキストを読み取り、
視覚的に意味のまとまり(1文〜1キャッチコピー単位)ごとに「ブロック」へ分割してください。

各ブロックには、そのテキストが画像内で占める矩形領域を
正規化座標(0〜1、左上が原点)で付与します。

出力は必ずJSONのみ。例:
{
  "blocks": [
    {"text": "シミを消す美白サプリ", "bbox": {"x": 0.08, "y": 0.12, "w": 0.84, "h": 0.06}},
    {"text": "1日1粒で続けやすい", "bbox": {"x": 0.10, "y": 0.22, "w": 0.55, "h": 0.05}}
  ]
}

ルール:
- 読み取り順(上から下、左から右)でblocksを並べる
- textは画像に書かれた通り忠実に。改行は半角スペースに置換し1ブロック1行にする
- ロゴ・装飾・意味のない文字は除外
- 文字が全く無い画像なら {"blocks": []} を返す
- bboxはテキストを囲む最小の矩形の目安。x+w, y+h は1を超えない
- JSONのみ出力。マークダウンのコードフェンス・説明文は禁止`;

interface RawBlock {
  text?: string;
  bbox?: { x?: number; y?: number; w?: number; h?: number };
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

function clamp01(n: number | undefined, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function stripDataUrl(b64: string): string {
  const comma = b64.indexOf(',');
  return b64.startsWith('data:') && comma >= 0 ? b64.slice(comma + 1) : b64;
}

/**
 * 이미지 1장 OCR. imageIndex 는 호출자가 부여한다(여기서는 0 으로 두고 반환).
 */
export async function ocrImage(
  image: OcrImageInput,
  apiKey: string,
  modelOverride?: string
): Promise<Array<Pick<OcrBlock, 'text' | 'bbox'>>> {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const model =
    modelOverride ??
    process.env.CLAUDE_OCR_MODEL ??
    process.env.CLAUDE_MODEL ??
    'claude-sonnet-4-6';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType,
                  data: stripDataUrl(image.base64),
                },
              },
              {
                type: 'text',
                text: '画像のテキストをブロック単位で抽出し、指定のJSON形式で返してください。',
              },
            ],
          },
        ],
      },
      { signal: controller.signal }
    );

    const textPart = response.content.find((c) => c.type === 'text');
    if (!textPart || textPart.type !== 'text') return [];

    const parsed = JSON.parse(extractJson(textPart.text)) as { blocks?: RawBlock[] };
    const raw = parsed.blocks ?? [];

    const out: Array<Pick<OcrBlock, 'text' | 'bbox'>> = [];
    for (const b of raw) {
      const text = (b.text ?? '').trim();
      if (!text) continue;
      const x = clamp01(b.bbox?.x, 0);
      const y = clamp01(b.bbox?.y, 0);
      out.push({
        text,
        bbox: {
          x,
          y,
          w: clamp01(b.bbox?.w, 1 - x),
          h: clamp01(b.bbox?.h, 0.04),
        },
      });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
