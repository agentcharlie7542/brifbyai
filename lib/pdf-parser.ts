/**
 * PDF → 구조화된 오리엔트시트 JSON 변환.
 *
 * 1. pdf-parse 로 텍스트 추출 (서버 전용)
 * 2. Claude 로 오리엔트시트 필드별 정규화
 *
 * 학습 데이터 단계라 카테고리·약기법 검증까지는 하지 않고, 추후
 * RAG 컨텍스트로 쓰기 좋은 형태로 저장만 한다.
 */
import Anthropic from '@anthropic-ai/sdk';
// pdf-parse 의 index.js 가 모듈 로드 시 테스트 PDF 를 읽어 ENOENT 가 나는
// 알려진 버그가 있어, 내부 구현 파일을 직접 import 한다.
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  data: Buffer
) => Promise<{ text: string; numpages: number; info?: unknown }>;

import type { ProductCategory } from '@/lib/yakkihou/types';

export interface StructuredOrientSheet {
  campaign?: {
    name?: string;
    purpose?: string;
    period?: string;
  };
  product?: {
    name?: string;
    nameJa?: string;
    category?: ProductCategory | string;
    keyIngredients?: string[];
    approvedClaims?: string[];
    targetMarket?: 'jp' | 'kr' | 'global';
    price?: string;
    qoo10Url?: string;
  };
  target?: {
    audience?: string;
    creatorPersona?: string;
  };
  content?: {
    requiredMessages?: string[];
    toneAndStyle?: string;
    keyMessages?: string[];
    prohibitedExpressions?: string[];
    sampleCopy?: string[];
  };
  ops?: {
    channels?: string[];
    hashtags?: string[];
    kpi?: string;
    deadline?: string;
  };
  /** Claude 가 자동 라벨링한 문장 단위 약기법 힌트 (학습용, 참고만) */
  sentenceHints?: Array<{
    text: string;
    hint: 'SAFE' | 'WARN' | 'NG';
    note?: string;
  }>;
  /** 위 필드 어디에도 안 들어간 자유 메모 */
  notes?: string;
}

export interface ParseResult {
  rawText: string;
  pages: number;
  structured: StructuredOrientSheet;
}

const STRUCTURE_SYSTEM_PROMPT = `당신은 일본 시장 인플루언서 마케팅 오리엔트시트의 구조화 도우미입니다.
사용자가 PDF에서 추출한 원본 텍스트를 주면, 다음 JSON 스키마에 맞춰 정규화하세요.

규칙:
- 텍스트에 명시되지 않은 필드는 생략합니다. 추측·창작 금지.
- 문장은 원본 그대로 보존합니다. 번역하지 않습니다.
- sentenceHints 는 시트 본문(상품 소개·키 메시지·예시 카피)에 등장한 일본어 문장만 대상으로,
  명백히 약기법 위반으로 보이는 표현(치료/완치/예방/シミを消す/痩せる/免疫力アップ 등)은 NG,
  애매하면 WARN, 사실 진술·성분 표기·일반 표현은 SAFE 로 라벨링합니다.
- JSON 만 출력합니다. 마크다운 코드펜스, 설명, 머리말 모두 금지.`;

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

export async function extractTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  pages: number;
}> {
  const { text, numpages } = await pdfParse(buffer);
  return { text, pages: numpages };
}

// Vercel Hobby 함수 maxDuration(60s) 안에서 안전하게 끝나도록 55s.
// pdf-parse + DB write 시간을 위해 5s 여유를 둔다.
const REQUEST_TIMEOUT_MS = 55_000;
const MAX_ATTEMPTS = 2;

async function callClaudeOnce(
  rawText: string,
  apiKey: string,
  model: string
): Promise<StructuredOrientSheet> {
  // 매번 신규 클라이언트 — undici keep-alive pool 오염 방지
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const truncated = rawText.length > 8000 ? rawText.slice(0, 8000) : rawText;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model,
        // 4096 은 sentenceHints 가 긴 PDF 에서 JSON 잘림 빈발. 8192 로 충분한 여유 확보.
        max_tokens: 8192,
        system: STRUCTURE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `다음은 PDF에서 추출한 오리엔트시트 원본 텍스트입니다. JSON 으로 구조화하세요.\n\n${truncated}`,
          },
        ],
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
        `Claude 응답 JSON 파싱 실패: ${(err as Error).message}\n응답 본문 일부:\n${textPart.text.slice(0, 400)}`
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function structureWithClaude(
  rawText: string,
  apiKey: string,
  modelOverride?: string
): Promise<StructuredOrientSheet> {
  const model = modelOverride ?? process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5';
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await callClaudeOnce(rawText, apiKey, model);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // JSON 파싱 실패는 재시도해도 동일하므로 즉시 포기
      if (msg.startsWith('Claude 응답 JSON 파싱 실패')) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function parseAndStructurePdf(
  buffer: Buffer,
  apiKey: string,
  modelOverride?: string
): Promise<ParseResult> {
  const { text, pages } = await extractTextFromPdf(buffer);
  if (!text.trim()) {
    return {
      rawText: '',
      pages,
      structured: { notes: '(PDF에서 텍스트를 추출하지 못했습니다. OCR 필요)' },
    };
  }
  const structured = await structureWithClaude(text, apiKey, modelOverride);
  return { rawText: text, pages, structured };
}
