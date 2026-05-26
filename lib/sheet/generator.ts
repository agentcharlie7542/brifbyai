/**
 * Qoo10 상품 + 브랜드 컨텍스트 + 학습 PDF 참조 → 시트 초안(StructuredOrientSheet) 생성.
 *
 * 출력 스키마는 pdf-parser.ts 의 StructuredOrientSheet 를 그대로 재사용해 시트와
 * 학습 PDF 간 통일성을 유지한다(상세 페이지 UI 공유 + 재학습 시 동일 형태).
 *
 * 학습 PDF 참조 데이터가 크면 토큰이 폭발하므로 각 참조는 truncate.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Qoo10ProductData } from '@/lib/qoo10/types';
import type { ProductCategory } from '@/lib/yakkihou/types';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';

export interface SheetGenerateInput {
  product: Qoo10ProductData;
  brand: {
    name: string;
    nameJa?: string | null;
    defaultTone?: string | null;
    defaultMarket: string;
  };
  references: Array<{
    fileName: string;
    structured: Record<string, unknown> | null;
  }>;
  category: ProductCategory;
  campaignName?: string;
}

const SYSTEM_PROMPT = `당신은 일본 시장 인플루언서 마케팅 오리엔트시트 작성 어시스턴트입니다.
입력으로 받은 (1) Qoo10 상품 데이터, (2) 브랜드 컨텍스트, (3) 과거 시트 참조 JSON, (4) 제품 카테고리를 바탕으로
다음 JSON 스키마에 맞는 시트 초안을 만듭니다.

스키마:
{
  "campaign": { "name": string, "purpose": string, "period"?: string },
  "product":  { "name": string, "nameJa"?: string, "category": string, "keyIngredients"?: string[],
                 "approvedClaims"?: string[], "targetMarket": "jp"|"kr"|"global", "price"?: string, "qoo10Url": string },
  "target":   { "audience": string, "creatorPersona"?: string },
  "content":  { "requiredMessages": string[], "toneAndStyle": string, "keyMessages": string[],
                 "prohibitedExpressions"?: string[], "sampleCopy": string[] },
  "ops":      { "channels"?: string[], "hashtags"?: string[], "kpi"?: string, "deadline"?: string },
  "sentenceHints"?: Array<{ "text": string, "hint": "SAFE"|"WARN"|"NG", "note"?: string }>,
  "notes"?: string
}

작성 규칙:
- 모든 본문(키 메시지, 샘플 카피, 필수 메시지)은 **일본어**로 작성. 한국어 혼용 금지.
- 톤과 구성은 참조 시트의 패턴을 우선적으로 따른다(키 메시지 길이, 샘플 카피 스타일 등).
- 카테고리에 따라 약기법(薬機法) 위반 표현을 회피한다.
  * cosmetic: 56효능 범위 밖 효능 금지(治る/シミを消す 등 금지)
  * health_food: 치료/예방/효능 단정 금지(免疫力アップ/痩せる 단정 금지)
  * quasi_drug: product.approvedClaims 외의 효능 주장 금지
  * general_food: 일반 식품 — 기능성 표현 금지
- sampleCopy 는 3~5개. 각 80자 이내, 인스타·X 등 짧은 포맷 가정.
- sentenceHints 는 sampleCopy + keyMessages 중 명백히 NG 위험이 있는 문장만 라벨링(없으면 생략).
- 데이터가 없는 필드는 추측하지 말고 생략한다. 빈 배열·빈 문자열 금지.
- JSON 만 출력. 마크다운 코드펜스, 머리말, 설명 금지.`;

const REQUEST_TIMEOUT_MS = 55_000;
const MAX_ATTEMPTS = 2;

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…(생략)' : s;
}

function buildUserMessage(input: SheetGenerateInput): string {
  const refLines = input.references.length
    ? input.references
        .slice(0, 3)
        .map(
          (r, i) =>
            `[참조 ${i + 1}] ${r.fileName}\n` +
            truncate(JSON.stringify(r.structured ?? {}, null, 2), 2200)
        )
        .join('\n\n')
    : '(과거 시트 없음)';

  const productJson = JSON.stringify(
    {
      title: input.product.title,
      price: input.product.price,
      description: input.product.description,
      category: input.product.category,
      features: input.product.features?.slice(0, 12),
      seller: input.product.seller,
      url: input.product.url,
    },
    null,
    2
  );

  const brandJson = JSON.stringify(
    {
      name: input.brand.name,
      nameJa: input.brand.nameJa ?? null,
      defaultTone: input.brand.defaultTone ?? null,
      defaultMarket: input.brand.defaultMarket,
    },
    null,
    2
  );

  return [
    `[브랜드]`,
    brandJson,
    '',
    `[Qoo10 상품]`,
    truncate(productJson, 3000),
    '',
    `[제품 카테고리] ${input.category}`,
    '',
    `[캠페인명 힌트] ${input.campaignName?.trim() ? input.campaignName.trim() : '(자동 추정)'}`,
    '',
    `[과거 시트 참조]`,
    refLines,
    '',
    '위 정보로 시트 초안 JSON 을 작성하세요.',
  ].join('\n');
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

async function callClaudeOnce(
  input: SheetGenerateInput,
  apiKey: string,
  model: string
): Promise<StructuredOrientSheet> {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { signal: controller.signal }
    );
    const textPart = response.content.find((c) => c.type === 'text');
    if (!textPart || textPart.type !== 'text') {
      throw new Error('Claude 응답에 텍스트 콘텐츠가 없습니다');
    }
    try {
      return JSON.parse(extractJson(textPart.text)) as StructuredOrientSheet;
    } catch (err) {
      throw new Error(
        `Claude 응답 JSON 파싱 실패: ${(err as Error).message}\n응답 일부:\n${textPart.text.slice(0, 400)}`
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function generateSheet(
  input: SheetGenerateInput,
  apiKey: string,
  modelOverride?: string
): Promise<StructuredOrientSheet> {
  const model = modelOverride ?? process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5';
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await callClaudeOnce(input, apiKey, model);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('Claude 응답 JSON 파싱 실패')) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 약기법 검증용으로 시트의 일본어 본문을 한 덩어리로 합친다. */
export function flattenSheetText(sheet: StructuredOrientSheet): string {
  const parts: string[] = [];
  if (sheet.content?.keyMessages) parts.push(...sheet.content.keyMessages);
  if (sheet.content?.requiredMessages) parts.push(...sheet.content.requiredMessages);
  if (sheet.content?.sampleCopy) parts.push(...sheet.content.sampleCopy);
  if (sheet.content?.prohibitedExpressions)
    parts.push(...sheet.content.prohibitedExpressions);
  return parts.filter(Boolean).join('\n');
}
