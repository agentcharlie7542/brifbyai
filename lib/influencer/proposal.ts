/**
 * 표준 오리엔트시트 + 인플루언서 페르소나 → 인플루언서 맞춤 제안 (Claude).
 *
 * 출력은 StructuredOrientSheet 를 확장한 InfluencerProposalContent.
 * 약기법 검증은 호출자(API 라우트)가 flattenSheetText + validate 로 별도 수행.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
import type { InfluencerPersona } from './persona';
import type { SocialPlatform } from '@/lib/social/types';

export interface InfluencerProposalContent extends StructuredOrientSheet {
  /** 인플루언서 적합도·실행 가이드 */
  influencerFit?: {
    rationale?: string; // 이 인플루언서에 적합한 이유
    recommendedFormat?: string; // 추천 포맷 (쇼츠/롱폼/릴스 등)
    hooks?: string[]; // 도입부 후크 제안 (인플루언서 보이스)
    postingTips?: string[]; // 게시 팁
    risks?: string[]; // 협업 시 리스크/주의
  };
}

export interface ProposalInput {
  sheet: StructuredOrientSheet;
  sheetCategory: string;
  persona: InfluencerPersona;
  influencer: {
    platform: SocialPlatform;
    handle: string;
    displayName?: string;
    followerCount?: number;
  };
}

const SYSTEM_PROMPT = `당신은 일본 시장 인플루언서 마케팅 시트 개인화 전문가입니다.
입력으로 (1) 확정된 표준 오리엔트시트, (2) 제품 카테고리, (3) 인플루언서 페르소나, (4) 인플루언서 기본정보를 받습니다.
표준 시트의 핵심 메시지·샘플 카피를 해당 인플루언서의 보이스·포맷·오디언스에 맞게 재구성한 "맞춤 제안"을 만듭니다.

출력 JSON 스키마 (표준 시트 구조 + influencerFit 확장):
{
  "campaign": { "name"?: string, "purpose"?: string, "period"?: string },
  "product": { ... 표준 시트의 product 를 그대로 또는 보강 ... },
  "target": { "audience"?: string, "creatorPersona"?: string },
  "content": {
    "requiredMessages"?: string[],
    "toneAndStyle"?: string,        // 이 인플루언서 보이스 기준
    "keyMessages"?: string[],       // 인플루언서 보이스로 재작성
    "prohibitedExpressions"?: string[],
    "sampleCopy"?: string[]         // 인플루언서가 실제 올릴 법한 일본어 카피 3~5개
  },
  "ops": { "channels"?: string[], "hashtags"?: string[], "kpi"?: string, "deadline"?: string },
  "sentenceHints"?: Array<{ "text": string, "hint": "SAFE"|"WARN"|"NG", "note"?: string }>,
  "influencerFit": {
    "rationale"?: string,
    "recommendedFormat"?: string,
    "hooks"?: string[],
    "postingTips"?: string[],
    "risks"?: string[]
  },
  "notes"?: string
}

규칙:
- 모든 본문(키 메시지·샘플 카피·후크)은 **일본어**로 작성. 인플루언서의 톤을 반영.
- 표준 시트의 핵심 메시지를 왜곡하지 말고 보이스만 조정.
- 제품 카테고리 약기법을 준수 (효능 단정·치료 표현 금지). 인플루언서가 과장 경향이면 risks 에 명시.
- 데이터 없는 필드는 생략. JSON 만 출력 (코드펜스·설명 금지).`;

const REQUEST_TIMEOUT_MS = 55_000;
const MAX_ATTEMPTS = 2;

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) return text.slice(a, b + 1);
  return text.trim();
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…(생략)' : s;
}

function buildUserMessage(input: ProposalInput): string {
  return [
    `[제품 카테고리] ${input.sheetCategory}`,
    '',
    `[인플루언서]`,
    JSON.stringify(input.influencer, null, 2),
    '',
    `[인플루언서 페르소나]`,
    truncate(JSON.stringify(input.persona, null, 2), 1800),
    '',
    `[확정 표준 오리엔트시트]`,
    truncate(JSON.stringify(input.sheet, null, 2), 4000),
    '',
    '위 정보로 인플루언서 맞춤 제안 JSON 을 작성하세요.',
  ].join('\n');
}

async function callOnce(
  input: ProposalInput,
  apiKey: string,
  model: string
): Promise<InfluencerProposalContent> {
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
      throw new Error('Claude 응답에 텍스트가 없습니다');
    }
    try {
      return JSON.parse(extractJson(textPart.text)) as InfluencerProposalContent;
    } catch (err) {
      throw new Error(
        `Claude 응답 JSON 파싱 실패: ${(err as Error).message}\n응답 일부:\n${textPart.text.slice(0, 400)}`
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function generateProposal(
  input: ProposalInput,
  apiKey: string,
  modelOverride?: string
): Promise<InfluencerProposalContent> {
  const model = modelOverride ?? process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5';
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await callOnce(input, apiKey, model);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('Claude 응답 JSON 파싱 실패')) throw err;
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
