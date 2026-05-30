/**
 * SocialProfile(최근 게시물 포함) → 인플루언서 페르소나 추출 (Claude).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SocialProfile } from '@/lib/social/types';

export interface InfluencerPersona {
  /** 한두 문장 요약 */
  summary?: string;
  /** 말투·톤 (예: 친근/전문/유머러스) */
  tone?: string;
  /** 주력 주제 */
  topics?: string[];
  /** 주 오디언스 (연령/성별/관심사) */
  audience?: string;
  /** 잘하는 콘텐츠 포맷 (쇼츠/롱폼/릴스/하우투 등) */
  contentFormats?: string[];
  /** 브랜드 협업 시 강점 */
  strengths?: string[];
  /** 약기법/브랜드 관점 주의점 (과장 표현 경향 등) */
  cautions?: string[];
}

const SYSTEM_PROMPT = `당신은 일본·한국 시장 인플루언서 마케팅 분석가입니다.
주어진 인플루언서의 프로필과 최근 게시물(제목·캡션·태그·지표)을 분석해 아래 JSON 스키마로 페르소나를 추출하세요.

스키마:
{
  "summary": string,            // 한두 문장 요약
  "tone": string,               // 말투·톤
  "topics": string[],           // 주력 주제 3~6개
  "audience": string,           // 주 오디언스 추정
  "contentFormats": string[],   // 잘하는 포맷
  "strengths": string[],        // 브랜드 협업 시 강점
  "cautions": string[]          // 약기법/브랜드 관점 주의점 (없으면 빈 배열 대신 생략)
}

규칙:
- 게시물 데이터에 근거해 추론하고, 데이터가 빈약하면 추측을 줄이고 summary 에 "데이터 부족" 취지를 명시.
- 원문 언어(일본어/한국어)는 보존하되 분석 텍스트는 한국어로 작성.
- JSON 만 출력. 코드펜스·머리말·설명 금지.`;

const REQUEST_TIMEOUT_MS = 55_000;

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) return text.slice(a, b + 1);
  return text.trim();
}

function buildUserMessage(profile: SocialProfile): string {
  const posts = profile.posts.slice(0, 12).map((p, i) => ({
    i: i + 1,
    title: p.title,
    caption: p.caption?.slice(0, 400),
    tags: p.tags?.slice(0, 10),
    metrics: p.metrics,
    publishedAt: p.publishedAt,
  }));
  return [
    `[플랫폼] ${profile.platform}`,
    `[핸들] ${profile.handle}`,
    `[표시명] ${profile.displayName ?? '-'}`,
    `[팔로워] ${profile.followerCount ?? '미상'}`,
    `[소개]`,
    profile.bio ?? '(없음)',
    '',
    `[최근 게시물]`,
    JSON.stringify(posts, null, 2),
    '',
    '위 데이터로 페르소나 JSON 을 작성하세요.',
  ].join('\n');
}

export async function generatePersona(
  profile: SocialProfile,
  apiKey: string,
  modelOverride?: string
): Promise<InfluencerPersona> {
  const model = modelOverride ?? process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5';
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(profile) }],
      },
      { signal: controller.signal }
    );
    const textPart = response.content.find((c) => c.type === 'text');
    if (!textPart || textPart.type !== 'text') {
      throw new Error('Claude 응답에 텍스트가 없습니다');
    }
    return JSON.parse(extractJson(textPart.text)) as InfluencerPersona;
  } finally {
    clearTimeout(timer);
  }
}
