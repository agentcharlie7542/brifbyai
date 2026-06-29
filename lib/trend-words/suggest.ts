/**
 * Tier 3 — 사전(DB)에 없는 한국 트렌드 워드를 입력받아 Claude 가 일본어 후보를 생성.
 *
 * 정의서 STEP 3(Candidate Generation) + §4 데이터 기반 추천 UX 를 LLM 으로 근사한다.
 * - IG 해시태그 수는 실측 API 가 없으므로 Claude 의 "추정치(ESTIMATED)" 임을 명시.
 * - 생성 결과는 화면 제안일 뿐 자동 저장하지 않는다. 사용자가 채택 시 register 로 영속화.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface SuggestedCandidate {
  jpTerm: string;
  jpReading: string | null;
  scriptType:
    | 'KANJI'
    | 'KATAKANA'
    | 'HIRAGANA'
    | 'MIXED'
    | 'ROMAN'
    | 'UNKNOWN';
  matchType: 'A' | 'B' | 'C' | 'D' | null;
  /** Claude 추정 IG 해시태그 인용 규모 (ESTIMATED) */
  estimatedHashtagCount: number | null;
  exposureLevel: 'HIGH' | 'MID' | 'LOW' | null;
  aversionLevel: 'LOW' | 'MID' | 'HIGH' | null;
  relatedKeywords: string[];
  /** 유사 번역·동의 표현 */
  similarTerms: string[];
  nuanceNote: string | null;
  yakkihouRisk: 'SAFE' | 'CAUTION' | 'PROHIBITED' | null;
  yakkihouNote: string | null;
}

export interface SuggestResult {
  candidates: SuggestedCandidate[];
}

const SYSTEM = `당신은 한국 K-뷰티/헬스 트렌드 마케팅 단어를 일본 현지 시장(Qoo10 JP·Amazon JP·IG/TikTok)에 맞는
일본어 표현으로 변환하는 "언어 패키징 엔진" 입니다. 단순 번역이 아니라
(a) 일본 소비자가 실제로 검색·해시태그하는 단어, (b) 거부감 없이 자연스러운 표현,
(c) 일본 薬機法(약기법)을 위반하지 않는 표현 으로 변환합니다.

입력된 한국 트렌드 워드에 대해 일본어 후보 3~5개를 생성하세요. 각 후보는 매칭유형을 분류합니다:
  - A : 한자 직수용 (한국 한자어가 일본에 그대로 정착. 예 물광피부→水光肌)
  - B : 음차 외래어 (영어 기반을 카타카나로. 예 글로우→グロウ)
  - C : 의미 현지화 (일본 고유 표현으로 치환. 예 모공레스→毛穴レス)
  - D : 시장 재정의 (개념·단어 부여로 카피 재설계. 예 여성청결제→デリケートゾーンケア)

각 후보에 대해 다음을 추정/판단:
  - jpReading: 카타카나/히라가나 읽기 (한자·혼합이면 후리가나, 외래어면 그대로)
  - scriptType: KANJI / KATAKANA / HIRAGANA / MIXED / ROMAN / UNKNOWN
  - estimatedHashtagCount: 일본 IG 해시태그 대략 규모(정수, 추정치). 모르면 null
  - exposureLevel: 검색·태그 노출 잠재력 HIGH / MID / LOW
  - aversionLevel: 일본 소비자 거부감/위화감 LOW(자연스러움) / MID / HIGH(부자연)
  - relatedKeywords: 함께 묶을 연관 검색·태그 일본어 키워드 (2~4개)
  - similarTerms: 유사·동의 일본어 표현 (있으면)
  - nuanceNote: 뉘앙스·사용 맥락 (한국어로 간단히)
  - yakkihouRisk: SAFE(효능 단정 없음) / CAUTION(조건부, 약사 확인 필요) / PROHIBITED(효능·치료 단정)
  - yakkihouNote: 약기법 주의사항 (한국어로 간단히)

출력은 반드시 JSON. 예:
{
  "candidates": [
    {"jpTerm":"水光肌","jpReading":"すいこうはだ","scriptType":"KANJI","matchType":"A",
     "estimatedHashtagCount":1200000,"exposureLevel":"HIGH","aversionLevel":"LOW",
     "relatedKeywords":["ツヤ肌","透明感"],"similarTerms":["ツヤ肌"],
     "nuanceNote":"가장 정착된 표현","yakkihouRisk":"SAFE","yakkihouNote":null}
  ]
}

규칙:
- JSON 만 출력. 마크다운 코드펜스·설명문 금지.
- estimatedHashtagCount 는 어디까지나 추정치이며 실측이 아님.
- 펨케어/이너뷰티 단어는 의료·치료·살균 직접 표현을 피하고 yakkihouRisk 를 보수적으로 판정.`;

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

const SCRIPT_TYPES = [
  'KANJI',
  'KATAKANA',
  'HIRAGANA',
  'MIXED',
  'ROMAN',
  'UNKNOWN',
] as const;
const MATCH_TYPES = ['A', 'B', 'C', 'D'] as const;
const EXPOSURE = ['HIGH', 'MID', 'LOW'] as const;
const AVERSION = ['LOW', 'MID', 'HIGH'] as const;
const RISK = ['SAFE', 'CAUTION', 'PROHIBITED'] as const;

function pick<T extends readonly string[]>(
  arr: T,
  v: unknown
): T[number] | null {
  return typeof v === 'string' && (arr as readonly string[]).includes(v)
    ? (v as T[number])
    : null;
}
function strArr(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : [];
}
function intOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

export async function suggestCandidates(
  krTerm: string,
  apiKey: string,
  opts?: { category?: string; modelOverride?: string }
): Promise<SuggestResult> {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const model =
    opts?.modelOverride ?? process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

  const userContent = [
    `한국 트렌드 워드: ${krTerm}`,
    opts?.category ? `카테고리(참고): ${opts.category}` : null,
    '',
    '위 단어의 일본어 매칭 후보 3~5개를 JSON 으로 생성하세요.',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 2048,
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
      candidates?: unknown[];
    };
    const raw = Array.isArray(parsed.candidates) ? parsed.candidates : [];

    const candidates: SuggestedCandidate[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const jpTerm = strOrNull(o.jpTerm);
      if (!jpTerm) continue;
      candidates.push({
        jpTerm,
        jpReading: strOrNull(o.jpReading),
        scriptType: pick(SCRIPT_TYPES, o.scriptType) ?? 'UNKNOWN',
        matchType: pick(MATCH_TYPES, o.matchType),
        estimatedHashtagCount: intOrNull(o.estimatedHashtagCount),
        exposureLevel: pick(EXPOSURE, o.exposureLevel),
        aversionLevel: pick(AVERSION, o.aversionLevel),
        relatedKeywords: strArr(o.relatedKeywords),
        similarTerms: strArr(o.similarTerms),
        nuanceNote: strOrNull(o.nuanceNote),
        yakkihouRisk: pick(RISK, o.yakkihouRisk),
        yakkihouNote: strOrNull(o.yakkihouNote),
      });
    }
    return { candidates };
  } finally {
    clearTimeout(timer);
  }
}
