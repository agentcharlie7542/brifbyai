/**
 * Layer 3 — Claude 가 Layer 1·2 를 통과한 ambiguous 문장만 판정.
 *
 * - Layer 1/2 가 잡은 문장은 절대 다시 검사하지 않음 (중복 라벨 방지 + 비용 절감)
 * - 한 번의 API 호출에 모든 ambiguous 문장을 함께 보냄 (배치)
 * - 결과는 카테고리별 컨텍스트와 함께 SAFE/WARN/NG 라벨
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  ProductCategory,
  YakkihouFinding,
  YakkihouLevel,
  YakkihouRuleset,
} from './types';
import type { Segment } from './segmenter';

const SYSTEM = `당신은 일본 약기법(薬機法)·식품표시법·경품표시법 컴플라이언스 어시스턴트입니다.

각 입력 문장이 광고·홍보 카피로 사용될 때의 위반 가능성을 판단해
다음 3단계로 라벨링하세요.

  - SAFE : 위반 가능성이 매우 낮음 (사실 진술, 성분 표기, 사용법 등)
  - WARN : 맥락에 따라 위반 가능성 존재. 사람이 한 번 더 확인 필요
  - NG   : 명확한 위반 가능성 (의약품적 효능 단정, 질병명 + 효과, 등)

판정 시 카테고리 규칙을 반드시 고려:
  - cosmetic       : 후생노동성 화장품 56효능 범위 밖이면 NG
  - quasi_drug     : 승인 효능 외 표현은 NG
  - health_food    : 의약품 효능 표현 (治る/予防/改善), 질환명+효능, 신체 변화 단언 모두 NG
  - functional_food: 신고된 기능성 외 표현은 NG
  - general_food   : 보건 효과 일체 NG

출력은 반드시 JSON. 예:
{
  "findings": [
    {"index": 0, "level": "NG", "reason": "...", "suggestions": ["..."]},
    {"index": 1, "level": "SAFE"}
  ]
}

규칙:
- 모든 입력 문장에 대해 정확히 하나의 결과를 반환 (인덱스 0부터)
- SAFE 인 경우 reason·suggestions 생략 가능
- WARN/NG 인 경우 reason 필수, suggestions 는 가능하면 1~2개의 일본어 대체 표현
- JSON 만 출력. 마크다운 코드펜스·설명문 금지.`;

interface ClaudeRawFinding {
  index: number;
  level: YakkihouLevel;
  reason?: string;
  suggestions?: string[];
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

export async function runLayer3(
  segments: Segment[],
  ruleset: YakkihouRuleset,
  apiKey: string,
  modelOverride?: string
): Promise<YakkihouFinding[]> {
  if (segments.length === 0) return [];

  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const model = modelOverride ?? process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

  const userContent = [
    `カテゴリ: ${ruleset.category} (${ruleset.categoryLabel})`,
    `カテゴリ説明: ${ruleset.description}`,
    '',
    '判定対象の文章:',
    ...segments.map((s, i) => `[${i}] ${s.text}`),
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      },
      { signal: controller.signal }
    );

    const text = response.content.find((c) => c.type === 'text');
    if (!text || text.type !== 'text') {
      throw new Error('Claude 응답에 텍스트 없음');
    }

    const parsed = JSON.parse(extractJson(text.text)) as {
      findings?: ClaudeRawFinding[];
    };
    const raw = parsed.findings ?? [];

    const out: YakkihouFinding[] = [];
    for (const f of raw) {
      if (f.level === 'SAFE') continue;
      const seg = segments[f.index];
      if (!seg) continue;
      out.push({
        text: seg.text,
        startIndex: seg.startIndex,
        endIndex: seg.endIndex,
        level: f.level,
        rule: 'claude.judge',
        reason: f.reason ?? '',
        suggestions: f.suggestions ?? [],
        category: ruleset.category,
        layer: 3,
      });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
