'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  MatchTypeBadge,
  ScriptTypeBadge,
  ExposureBadge,
  AversionBadge,
  YakkihouRiskBadge,
  HashtagCount,
} from '@/components/trend-word-badges';

// ── 타입 (API 응답 = drizzle camelCase) ──
interface Candidate {
  id: string;
  jpTerm: string;
  jpReading: string | null;
  literalBaseline: string | null;
  scriptType: string | null;
  matchType: string | null;
  priorityRank: number;
  igHashtagCount: number | null;
  igCountStatus: string | null;
  exposureLevel: string | null;
  aversionLevel: string | null;
  yakkihouRisk: string | null;
  yakkihouNote: string | null;
  nuanceNote: string | null;
  brandAdoption: string[] | null;
  relatedKeywords: string[] | null;
  source: string | null;
}
interface Group {
  krTermId: string;
  krTerm: string;
  category: string | null;
  subCategory: string | null;
  candidates: Candidate[];
}
interface SearchResponse {
  status: 'FOUND' | 'UNREGISTERED';
  groups: Group[];
}
export interface Convention {
  id: string;
  brand: string;
  brandType: 'OWNED' | 'COMPETITOR';
  categoryHint: string | null;
  styleNote: string | null;
  adoptedTerms: string[] | null;
  avoidTerms: string | null;
}
interface Suggested {
  jpTerm: string;
  jpReading: string | null;
  scriptType: string;
  matchType: string | null;
  estimatedHashtagCount: number | null;
  exposureLevel: string | null;
  aversionLevel: string | null;
  relatedKeywords: string[];
  similarTerms: string[];
  nuanceNote: string | null;
  yakkihouRisk: string | null;
  yakkihouNote: string | null;
}

// 엔진 카테고리 → 약기법 ProductCategory 매핑
const CATEGORY_TO_PRODUCT: Record<string, string> = {
  스킨케어: 'cosmetic',
  메이크업: 'cosmetic',
  성분: 'cosmetic',
  헤어: 'cosmetic',
  바디: 'cosmetic',
  펨케어: 'quasi_drug',
  다이어트: 'health_food',
  커머스: 'general',
};
function toProductCategory(cat?: string | null): string {
  return (cat && CATEGORY_TO_PRODUCT[cat]) || 'cosmetic';
}

function findConvention(
  name: string,
  conventions: Convention[]
): Convention | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return conventions.find((c) => {
    const b = c.brand.toLowerCase();
    return b === n || b.includes(n) || n.includes(b);
  });
}

export function TrendWordsClient({
  conventions,
  categories,
}: {
  conventions: Convention[];
  categories: string[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string, cat: string | null) => {
    if (!q.trim()) {
      setResult(null);
      setError(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trend-words/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q, category: cat ?? undefined }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.detail ?? json?.error ?? `HTTP ${res.status}`);
      setResult(json);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runSearch(query, category);
    }, 450);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, category, runSearch]);

  const refresh = useCallback(
    () => runSearch(query, category),
    [runSearch, query, category]
  );

  return (
    <div className="space-y-6">
      {/* 검색바 */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="한국 트렌드 워드 입력 (예: 물광피부, 여성청결제, 모공)"
            className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            label="전체"
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            />
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-yakkihou-ng/30 bg-yakkihou-ng/5 px-4 py-3 text-sm text-yakkihou-ng">
          검색 실패: {error}
        </p>
      ) : null}

      {/* 결과 */}
      {result?.status === 'FOUND' ? (
        <div className="space-y-5">
          {result.groups.map((g) => (
            <GroupCard
              key={g.krTermId}
              group={g}
              conventions={conventions}
            />
          ))}
        </div>
      ) : result?.status === 'UNREGISTERED' ? (
        <UnregisteredPanel
          krTerm={query.trim()}
          category={category}
          onRegistered={refresh}
        />
      ) : !loading && query.trim() ? (
        <p className="text-sm text-muted-foreground">결과 없음</p>
      ) : null}

      {!query.trim() ? <Legend /> : null}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

// ── 검색 결과 그룹 카드 ──
function GroupCard({
  group,
  conventions,
}: {
  group: Group;
  conventions: Convention[];
}) {
  const productCategory = toProductCategory(group.category);
  const showQuadrant =
    group.candidates.filter((c) => c.exposureLevel && c.aversionLevel).length >=
    2;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">{group.krTerm}</span>
          {group.category ? (
            <span className="text-xs text-muted-foreground">
              {group.category}
              {group.subCategory ? ` / ${group.subCategory}` : ''}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          후보 {group.candidates.length}
        </span>
      </div>

      {group.candidates.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          등록된 일본어 후보가 없습니다.
        </p>
      ) : (
        <ul className="divide-y">
          {group.candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              conventions={conventions}
              productCategory={productCategory}
            />
          ))}
        </ul>
      )}

      {showQuadrant ? (
        <div className="border-t bg-muted/20 px-4 py-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            노출 × 거부감 매트릭스 (우상단 = 채택 권장존)
          </p>
          <Quadrant candidates={group.candidates} />
        </div>
      ) : null}
    </Card>
  );
}

function CandidateRow({
  candidate: c,
  conventions,
  productCategory,
}: {
  candidate: Candidate;
  conventions: Convention[];
  productCategory: string;
}) {
  const isAvoid = c.matchType === 'X';
  return (
    <li className={cn('px-4 py-3 text-sm', isAvoid && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* 우선순위 */}
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary"
          title={`우선순위 ${c.priorityRank}`}
        >
          {c.priorityRank}
        </span>
        {/* 일본어 후보 */}
        <span className="font-medium">
          {isAvoid ? <span className="line-through">{c.jpTerm}</span> : c.jpTerm}
        </span>
        {c.jpReading ? (
          <span className="text-xs text-muted-foreground">{c.jpReading}</span>
        ) : null}
        {c.source && c.source !== 'SEED' ? (
          <span className="rounded bg-accent px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
            {c.source}
          </span>
        ) : null}
        {isAvoid ? (
          <span className="text-[10px] font-semibold text-yakkihou-ng">
            ✗ 사용 지양
          </span>
        ) : null}

        {/* 배지들 */}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <ScriptTypeBadge type={c.scriptType} />
          <MatchTypeBadge type={c.matchType} />
          <ExposureBadge level={c.exposureLevel} />
          <AversionBadge level={c.aversionLevel} />
          <YakkihouRiskBadge risk={c.yakkihouRisk} />
          <HashtagCount count={c.igHashtagCount} status={c.igCountStatus} />
        </span>
      </div>

      {/* 직역 비교 */}
      {c.literalBaseline && c.literalBaseline !== c.jpTerm ? (
        <p className="mt-1 text-xs text-muted-foreground">
          직역: <span className="line-through">{c.literalBaseline}</span> →{' '}
          {c.jpTerm}
        </p>
      ) : null}

      {/* 뉘앙스 / 약기법 비고 */}
      {c.nuanceNote ? (
        <p className="mt-1 text-xs text-muted-foreground">{c.nuanceNote}</p>
      ) : null}
      {c.yakkihouNote ? (
        <p className="mt-0.5 text-xs text-yakkihou-warn">⚠ {c.yakkihouNote}</p>
      ) : null}

      {/* 연관 키워드 칩 */}
      {c.relatedKeywords && c.relatedKeywords.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {c.relatedKeywords.map((k, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              #{k}
            </span>
          ))}
        </div>
      ) : null}

      {/* 브랜드 채택 오버레이 */}
      <BrandOverlay
        names={c.brandAdoption ?? []}
        conventions={conventions}
      />

      {/* 약기법 라이브 재검 */}
      <YakkihouRecheck text={c.jpTerm} category={productCategory} />
    </li>
  );
}

function BrandOverlay({
  names,
  conventions,
}: {
  names: string[];
  conventions: Convention[];
}) {
  if (names.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">채택:</span>
      {names.map((name, i) => {
        const conv = findConvention(name, conventions);
        const owned = conv?.brandType === 'OWNED';
        return (
          <span
            key={i}
            title={
              conv
                ? `${conv.brand}${conv.styleNote ? ` — ${conv.styleNote}` : ''}${owned && conv.avoidTerms ? `\n⚠ 회피: ${conv.avoidTerms}` : ''}`
                : name
            }
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px]',
              owned
                ? 'border-yakkihou-warn/40 bg-yakkihou-warn/10 text-yakkihou-warn'
                : 'border-input bg-background text-muted-foreground'
            )}
          >
            {owned ? '★ ' : ''}
            {name}
          </span>
        );
      })}
    </div>
  );
}

// ── 약기법 라이브 재검 (기존 /api/yakkihou/validate 재사용) ──
function YakkihouRecheck({
  text,
  category,
}: {
  text: string;
  category: string;
}) {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'done'; level: 'SAFE' | 'WARN' | 'NG' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const run = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/yakkihou/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, category, skipLayer3: true }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.detail ?? json?.error ?? `HTTP ${res.status}`);
      const s = json.summary ?? { safe: 0, warn: 0, ng: 0 };
      const level = s.ng > 0 ? 'NG' : s.warn > 0 ? 'WARN' : 'SAFE';
      setState({ kind: 'done', level });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'error',
      });
    }
  }, [text, category]);

  const levelClass = {
    SAFE: 'text-yakkihou-safe',
    WARN: 'text-yakkihou-warn',
    NG: 'text-yakkihou-ng',
  } as const;

  return (
    <div className="mt-1.5">
      {state.kind === 'idle' ? (
        <button
          type="button"
          onClick={run}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ShieldCheck className="h-3 w-3" />
          약기법 라이브 검증
        </button>
      ) : state.kind === 'loading' ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          검증 중…
        </span>
      ) : state.kind === 'done' ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-semibold',
            levelClass[state.level]
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          라이브: {state.level}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] text-yakkihou-ng">
          <AlertTriangle className="h-3 w-3" />
          {state.message}
        </span>
      )}
    </div>
  );
}

// ── 노출 × 거부감 3×3 사분면 (의존성 없는 CSS 그리드) ──
const EXP_COLS = ['LOW', 'MID', 'HIGH'] as const; // X축: 노출 낮음→높음
const AV_ROWS = ['LOW', 'MID', 'HIGH'] as const; // Y축: 거부감 낮음(위)→높음(아래)

function Quadrant({ candidates }: { candidates: Candidate[] }) {
  const placed = candidates.filter((c) => c.exposureLevel && c.aversionLevel);
  const cell = (av: string, exp: string) =>
    placed.filter((c) => c.aversionLevel === av && c.exposureLevel === exp);

  return (
    <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1 text-[10px]">
      {/* 헤더 행 */}
      <div />
      {EXP_COLS.map((e) => (
        <div key={e} className="px-1 pb-0.5 text-center text-muted-foreground">
          노출 {e === 'LOW' ? '低' : e === 'MID' ? '中' : '高'}
        </div>
      ))}
      {/* 데이터 행 */}
      {AV_ROWS.map((av) => (
        <FragmentRow key={av} av={av} cell={cell} />
      ))}
    </div>
  );
}

function FragmentRow({
  av,
  cell,
}: {
  av: string;
  cell: (av: string, exp: string) => Candidate[];
}) {
  return (
    <>
      <div className="flex items-center pr-1 text-right text-muted-foreground">
        거부감 {av === 'LOW' ? '低' : av === 'MID' ? '中' : '高'}
      </div>
      {EXP_COLS.map((exp) => {
        const items = cell(av, exp);
        const recommended = av === 'LOW' && exp === 'HIGH';
        return (
          <div
            key={exp}
            className={cn(
              'min-h-[2.25rem] rounded border p-1',
              recommended
                ? 'border-yakkihou-safe/50 bg-yakkihou-safe/10'
                : 'border-border bg-background'
            )}
          >
            <div className="flex flex-wrap gap-0.5">
              {items.map((c) => (
                <span
                  key={c.id}
                  className={cn(
                    'rounded px-1 py-0.5 text-[10px]',
                    recommended
                      ? 'bg-yakkihou-safe/20 text-yakkihou-safe'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {c.jpTerm}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── 미등록 단어: Claude 후보 제안 → 등록 ──
function UnregisteredPanel({
  krTerm,
  category,
  onRegistered,
}: {
  krTerm: string;
  category: string | null;
  onRegistered: () => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggested[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 후보별 선택/우선순위
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch('/api/trend-words/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: krTerm, category: category ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.detail ?? json?.error ?? `HTTP ${res.status}`);
      const cands: Suggested[] = json.candidates ?? [];
      setSuggestions(cands);
      // 기본: 전부 선택, 우선순위 = 순서대로 1,2,3…
      const initial: Record<number, number> = {};
      cands.forEach((_, i) => {
        initial[i] = i + 1;
      });
      setPicks(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setSuggesting(false);
    }
  }, [krTerm, category]);

  const register = useCallback(async () => {
    if (!suggestions) return;
    const selected = suggestions
      .map((s, i) => ({ s, rank: picks[i] }))
      .filter((x) => typeof x.rank === 'number' && x.rank > 0);
    if (selected.length === 0) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/trend-words/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          krTerm,
          category: category ?? undefined,
          candidates: selected.map(({ s, rank }) => ({
            jpTerm: s.jpTerm,
            jpReading: s.jpReading ?? undefined,
            scriptType: s.scriptType,
            matchType: s.matchType ?? undefined,
            priorityRank: rank,
            igHashtagCount: s.estimatedHashtagCount ?? undefined,
            exposureLevel: s.exposureLevel ?? undefined,
            aversionLevel: s.aversionLevel ?? undefined,
            yakkihouRisk: s.yakkihouRisk ?? undefined,
            yakkihouNote: s.yakkihouNote ?? undefined,
            nuanceNote: s.nuanceNote ?? undefined,
            relatedKeywords: s.relatedKeywords,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.detail ?? json?.error ?? `HTTP ${res.status}`);
      setRegistered(true);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setRegistering(false);
    }
  }, [suggestions, picks, krTerm, category, onRegistered]);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-yakkihou-warn/15 px-2 py-0.5 text-xs font-semibold text-yakkihou-warn">
          미등록
        </span>
        <p className="text-sm">
          <span className="font-medium">{krTerm}</span> 은(는) 사전에 없습니다.
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-yakkihou-ng">오류: {error}</p>
      ) : null}

      {suggestions === null ? (
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          {suggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          추천 후보 제안받기
        </button>
      ) : registered ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-yakkihou-safe">
          <Sparkles className="h-4 w-4" /> 등록 완료 — 검색 결과를 갱신했습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            아래는 Claude 제안 후보입니다(해시태그 수는 추정치). 등록할 후보의
            우선순위를 지정한 뒤 등록하세요.
          </p>
          <ul className="divide-y rounded-md border bg-card">
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm"
              >
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  순위
                  <input
                    type="number"
                    min={0}
                    value={picks[i] ?? 0}
                    onChange={(e) =>
                      setPicks((prev) => ({
                        ...prev,
                        [i]: Math.max(0, parseInt(e.target.value || '0', 10)),
                      }))
                    }
                    className="w-12 rounded border border-input bg-background px-1.5 py-1 text-center text-xs"
                  />
                </label>
                <span className="font-medium">{s.jpTerm}</span>
                {s.jpReading ? (
                  <span className="text-xs text-muted-foreground">
                    {s.jpReading}
                  </span>
                ) : null}
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  <ScriptTypeBadge type={s.scriptType} />
                  <MatchTypeBadge type={s.matchType} />
                  <ExposureBadge level={s.exposureLevel} />
                  <AversionBadge level={s.aversionLevel} />
                  <YakkihouRiskBadge risk={s.yakkihouRisk} />
                  <HashtagCount
                    count={s.estimatedHashtagCount}
                    status="ESTIMATED"
                  />
                </span>
                {s.nuanceNote ? (
                  <p className="w-full text-xs text-muted-foreground">
                    {s.nuanceNote}
                  </p>
                ) : null}
                {s.relatedKeywords.length > 0 || s.similarTerms.length > 0 ? (
                  <div className="flex w-full flex-wrap gap-1">
                    {[...s.relatedKeywords, ...s.similarTerms].map((k, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        #{k}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={register}
            disabled={registering}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {registering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            선택 후보 등록
          </button>
        </div>
      )}
    </Card>
  );
}

// ── 지표 가이드 범례 (지표가이드 CSV → TS 상수) ──
function Legend() {
  return (
    <div className="rounded-lg border bg-muted/20 p-5 text-sm">
      <h2 className="mb-3 font-semibold">지표 가이드</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <LegendBlock
          title="매칭유형"
          rows={[
            ['A', '한자 직수용 — 한국 한자어가 일본에 정착 (물광피부→水光肌)'],
            ['B', '음차 외래어 — 영어 기반을 카타카나로 (글로우→グロウ)'],
            ['C', '의미 현지화 — 일본 고유 표현으로 치환 (모공레스→毛穴レス)'],
            ['D', '시장 재정의 — 카피 재설계 (여성청결제→デリケートゾーンケア)'],
          ]}
        />
        <LegendBlock
          title="薬機法 리스크"
          rows={[
            ['SAFE', '효능 단정 없음 — 사용 가능'],
            ['CAUTION', '조건부 — 의약부외품 승인·근거 명시 필요'],
            ['PROHIBITED', '효능·치료 단정 — 사용 금지, 대체어 권장'],
          ]}
        />
        <LegendBlock
          title="검색 노출도 / 거부감"
          rows={[
            ['노출 高/中/低', '검색·태그 노출 잠재력 (高=제목 우선 채택)'],
            ['거부감 低/中/高', '일본 소비자 위화감 (低=자연스러움, 高=직역체)'],
          ]}
        />
        <LegendBlock
          title="데이터 주의"
          rows={[
            [
              'IG 해시태그',
              '현재 수치는 추정치(ESTIMATED). 실측 파이프라인 연동 시 VERIFIED 로 갱신',
            ],
            ['트렌드 수명', '트렌드어는 6~12개월 주기로 교체 — 정기 재검토 필요'],
          ]}
        />
      </div>
    </div>
  );
}

function LegendBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {rows.map(([k, v], i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span className="shrink-0 font-semibold text-foreground">{k}</span>
            <span className="text-muted-foreground">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
