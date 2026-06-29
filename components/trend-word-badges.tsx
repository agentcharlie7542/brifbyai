import { cn } from '@/lib/utils';

type Tone = 'good' | 'mid' | 'bad' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-yakkihou-safe/15 text-yakkihou-safe',
  mid: 'bg-yakkihou-warn/15 text-yakkihou-warn',
  bad: 'bg-yakkihou-ng/15 text-yakkihou-ng',
  neutral: 'bg-muted text-muted-foreground',
};

export function Badge({
  tone = 'neutral',
  title,
  className,
  children,
}: {
  tone?: Tone;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── 약기법 리스크 (SAFE / CAUTION / PROHIBITED) ──
const RISK: Record<string, { tone: Tone; label: string; title: string }> = {
  SAFE: { tone: 'good', label: '薬機 SAFE', title: '약기법: 효능 단정 없음, 사용 가능' },
  CAUTION: {
    tone: 'mid',
    label: '薬機 CAUTION',
    title: '약기법: 조건부 허용 — 약사 확인·근거 명시 필요',
  },
  PROHIBITED: {
    tone: 'bad',
    label: '薬機 NG',
    title: '약기법: 효능·치료 단정 — 사용 금지, 대체어 권장',
  },
};
export function YakkihouRiskBadge({ risk }: { risk?: string | null }) {
  if (!risk || !RISK[risk]) return null;
  const r = RISK[risk];
  return (
    <Badge tone={r.tone} title={r.title}>
      {r.label}
    </Badge>
  );
}

// ── 검색 노출도 (HIGH=高 좋음 / MID=中 / LOW=低) ──
const EXPOSURE: Record<string, { tone: Tone; jp: string }> = {
  HIGH: { tone: 'good', jp: '高' },
  MID: { tone: 'mid', jp: '中' },
  LOW: { tone: 'bad', jp: '低' },
};
export function ExposureBadge({ level }: { level?: string | null }) {
  if (!level || !EXPOSURE[level]) return null;
  const e = EXPOSURE[level];
  return (
    <Badge tone={e.tone} title={`검색 노출도 ${e.jp}`}>
      노출 {e.jp}
    </Badge>
  );
}

// ── 거부감/위화감 (LOW=低 좋음 / MID=中 / HIGH=高 나쁨) — 노출과 색 반전 ──
const AVERSION: Record<string, { tone: Tone; jp: string }> = {
  LOW: { tone: 'good', jp: '低' },
  MID: { tone: 'mid', jp: '中' },
  HIGH: { tone: 'bad', jp: '高' },
};
export function AversionBadge({ level }: { level?: string | null }) {
  if (!level || !AVERSION[level]) return null;
  const a = AVERSION[level];
  return (
    <Badge tone={a.tone} title={`거부감/위화감 ${a.jp}`}>
      거부감 {a.jp}
    </Badge>
  );
}

// ── 매칭유형 (A/B/C/D/X) ──
const MATCH: Record<string, string> = {
  A: '한자 직수용',
  B: '음차 외래어',
  C: '의미 현지화',
  D: '시장 재정의',
  X: '직역 (사용 지양)',
};
export function MatchTypeBadge({ type }: { type?: string | null }) {
  if (!type || !MATCH[type]) return null;
  return (
    <Badge tone={type === 'X' ? 'bad' : 'neutral'} title={MATCH[type]}>
      {type} · {MATCH[type]}
    </Badge>
  );
}

// ── 표기유형 ──
const SCRIPT: Record<string, string> = {
  KANJI: '漢字',
  KATAKANA: 'カナ',
  HIRAGANA: 'かな',
  MIXED: '혼합',
  ROMAN: '英',
  UNKNOWN: '-',
};
export function ScriptTypeBadge({ type }: { type?: string | null }) {
  if (!type || !SCRIPT[type] || type === 'UNKNOWN') return null;
  return <Badge tone="neutral">{SCRIPT[type]}</Badge>;
}

/** 해시태그 수를 일본식 万 단위로 압축 (1,200,000 → 120万) */
export function formatHashtagCount(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    return `${man % 1 === 0 ? man : man.toFixed(1)}万`;
  }
  return n.toLocaleString('ja-JP');
}

/** IG 해시태그 인용 수 — ESTIMATED 면 회색 + 물음표로 추정치 명시 (정의서 §4.6) */
export function HashtagCount({
  count,
  status,
}: {
  count?: number | null;
  status?: string | null;
}) {
  if (count == null) {
    return <span className="text-sm font-bold text-muted-foreground">—</span>;
  }
  const estimated = status !== 'VERIFIED';
  return (
    <span
      title={
        estimated
          ? 'IG 해시태그 추정치 (ESTIMATED) — 실측 아님'
          : 'IG 해시태그 실측치 (VERIFIED)'
      }
      className={cn(
        'inline-flex items-center gap-0.5 text-sm font-bold tabular-nums text-red-600'
      )}
    >
      #{formatHashtagCount(count)}
      {estimated ? <span>?</span> : null}
    </span>
  );
}
