'use client';

/**
 * Phase 3 MVP — textarea + 자동 렌더링 미리보기.
 *
 *  ┌─ category 셀렉트 ────────────┐
 *  │ 입력 (textarea)              │   ← 원본. 사용자가 자유 편집
 *  └──────────────────────────────┘
 *  ┌─ [🟢12 🟡3 🔴1] 검증 결과 ───┐
 *  │ 渋谷店 SAFE🟢                │   ← 하이라이트된 미리보기.
 *  │ ふっくらWARN🟡 ハリ感         │     클릭 시 팝오버: 이유 + 권장 표현 + [자동 교체]
 *  │ シミを消すNG🔴                │
 *  └──────────────────────────────┘
 *
 * 디바운스 600ms 로 자동 재검증. Layer 3 (Claude) 는 큰 텍스트에서 비용 부담이라
 * 기본은 skipLayer3=true. 토글로 켤 수 있음.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Finding {
  text: string;
  startIndex: number;
  endIndex: number;
  level: 'SAFE' | 'WARN' | 'NG';
  rule: string;
  reason: string;
  suggestions: string[];
  category: string;
  layer: 1 | 2 | 3;
}

interface ValidateResponse {
  segments: Array<{ text: string; startIndex: number; endIndex: number }>;
  findings: Finding[];
  summary: { safe: number; warn: number; ng: number };
  layerCounts: { layer1: number; layer2: number; layer3: number };
}

const CATEGORY_OPTIONS = [
  { value: 'health_food', label: '健康食品' },
  { value: 'cosmetic', label: '化粧品' },
  { value: 'quasi_drug', label: '医薬部外品' },
  { value: 'general_food', label: '一般食品' },
  { value: 'functional_food', label: '機能性表示食品' },
  { value: 'general', label: '一般' },
];

export function YakkihouValidator({
  initialText = '',
  initialCategory = 'health_food',
}: {
  initialText?: string;
  initialCategory?: string;
}) {
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState(initialCategory);
  const [useClaude, setUseClaude] = useState(false);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFindingIdx, setActiveFindingIdx] = useState<number | null>(null);

  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runValidate = useCallback(
    async (textValue: string, cat: string, withClaude: boolean) => {
      if (!textValue.trim()) {
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
        const res = await fetch('/api/yakkihou/validate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: textValue,
            category: cat,
            skipLayer3: !withClaude,
          }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail ?? json?.error ?? `HTTP ${res.status}`);
        setResult(json);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'unknown error');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 디바운스 자동 검증
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runValidate(text, category, useClaude);
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text, category, useClaude, runValidate]);

  /**
   * 텍스트와 findings 로부터 하이라이트된 segment 배열 생성.
   * findings 는 startIndex 오름차순 + 겹치는 구간은 더 강한 레벨이 이김(NG > WARN).
   */
  const highlightedSegments = useMemo(() => {
    if (!result) return null;
    // 정렬 + dedup (같은 start-end + level 한 번만)
    const sorted = [...result.findings].sort(
      (a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex
    );
    // overlap 처리: NG 우선
    const pickByRange = new Map<string, Finding>();
    for (const f of sorted) {
      const key = `${f.startIndex}-${f.endIndex}`;
      const prev = pickByRange.get(key);
      if (!prev || rankLevel(f.level) > rankLevel(prev.level)) {
        pickByRange.set(key, f);
      }
    }
    const picked = [...pickByRange.values()].sort(
      (a, b) => a.startIndex - b.startIndex
    );

    const out: Array<
      | { type: 'plain'; text: string }
      | { type: 'finding'; text: string; finding: Finding; findingIndex: number }
    > = [];
    let cursor = 0;
    picked.forEach((f, i) => {
      if (cursor < f.startIndex) {
        out.push({ type: 'plain', text: text.slice(cursor, f.startIndex) });
      }
      out.push({
        type: 'finding',
        text: text.slice(f.startIndex, f.endIndex),
        finding: f,
        findingIndex: i,
      });
      cursor = f.endIndex;
    });
    if (cursor < text.length) {
      out.push({ type: 'plain', text: text.slice(cursor) });
    }
    return { picked, segments: out };
  }, [result, text]);

  const summary = result?.summary ?? { safe: 0, warn: 0, ng: 0 };

  const applySuggestion = useCallback(
    (finding: Finding, suggestion: string) => {
      setText((prev) =>
        prev.slice(0, finding.startIndex) +
        suggestion +
        prev.slice(finding.endIndex)
      );
      setActiveFindingIdx(null);
    },
    []
  );

  const findingsList = highlightedSegments?.picked ?? [];

  return (
    <div className="space-y-6">
      {/* 컨트롤 */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            カテゴリ
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useClaude}
            onChange={(e) => setUseClaude(e.target.checked)}
          />
          Layer 3 (Claude) 사용
        </label>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              검증 중
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              자동 검증
            </>
          )}
        </div>
      </div>

      {/* 입력 */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground">
          입력 (원본 텍스트)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(8, Math.min(20, text.split('\n').length + 1))}
          placeholder="여기에 일본어 광고·홍보 문구를 붙여넣으세요. 600ms 후 자동으로 약기법 검증이 실행됩니다."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed shadow-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* 결과 배지 */}
      <div className="flex items-center justify-between rounded-md border bg-card px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <Pill icon={<CheckCircle2 className="h-3.5 w-3.5" />} count={summary.safe} kind="safe" label="SAFE" />
          <Pill icon={<AlertTriangle className="h-3.5 w-3.5" />} count={summary.warn} kind="warn" label="WARN" />
          <Pill icon={<XCircle className="h-3.5 w-3.5" />} count={summary.ng} kind="ng" label="NG" />
        </div>
        {result ? (
          <span className="text-xs text-muted-foreground">
            세그먼트 {result.segments.length}, finding {result.findings.length} · L1 {result.layerCounts.layer1} / L2 {result.layerCounts.layer2} / L3 {result.layerCounts.layer3}
          </span>
        ) : null}
      </div>

      {/* 미리보기 */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground">
          하이라이트 미리보기 (클릭으로 권장 표현 교체)
        </label>
        <div className="mt-1 min-h-[120px] whitespace-pre-wrap rounded-md border bg-card p-4 font-mono text-sm leading-relaxed">
          {error ? (
            <span className="text-yakkihou-ng">검증 실패: {error}</span>
          ) : highlightedSegments && text ? (
            highlightedSegments.segments.map((s, i) =>
              s.type === 'plain' ? (
                <span key={i}>{s.text}</span>
              ) : (
                <FindingChip
                  key={i}
                  segment={s.text}
                  finding={s.finding}
                  active={activeFindingIdx === s.findingIndex}
                  onToggle={() =>
                    setActiveFindingIdx(
                      activeFindingIdx === s.findingIndex ? null : s.findingIndex
                    )
                  }
                  onApply={(sug) => applySuggestion(s.finding, sug)}
                />
              )
            )
          ) : (
            <span className="text-muted-foreground">
              {loading
                ? '검증 중…'
                : '입력하면 자동으로 검증 결과가 여기에 표시됩니다.'}
            </span>
          )}
        </div>
      </div>

      {/* findings 목록 (테이블) */}
      {findingsList.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Findings ({findingsList.length})
          </h3>
          <ul className="divide-y rounded-md border bg-card text-sm">
            {findingsList.map((f, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2">
                <LevelBadge level={f.level} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium" title={f.text}>
                    {f.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    L{f.layer} · {f.rule} — {f.reason}
                  </p>
                  {f.suggestions.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {f.suggestions.map((s, j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => applySuggestion(f, s)}
                          className="rounded-full border border-yakkihou-safe/40 bg-yakkihou-safe/10 px-2 py-0.5 text-xs text-yakkihou-safe hover:bg-yakkihou-safe/20"
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function rankLevel(l: 'SAFE' | 'WARN' | 'NG'): number {
  return l === 'NG' ? 3 : l === 'WARN' ? 2 : 1;
}

function Pill({
  icon,
  count,
  kind,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  kind: 'safe' | 'warn' | 'ng';
  label: string;
}) {
  const cls =
    kind === 'safe'
      ? 'text-yakkihou-safe'
      : kind === 'warn'
        ? 'text-yakkihou-warn'
        : 'text-yakkihou-ng';
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', cls)}>
      {icon}
      {label} {count}
    </span>
  );
}

function LevelBadge({ level }: { level: 'SAFE' | 'WARN' | 'NG' }) {
  const map = {
    SAFE: 'bg-yakkihou-safe/15 text-yakkihou-safe',
    WARN: 'bg-yakkihou-warn/15 text-yakkihou-warn',
    NG: 'bg-yakkihou-ng/15 text-yakkihou-ng',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex h-5 w-12 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
        map[level]
      )}
    >
      {level}
    </span>
  );
}

function FindingChip({
  segment,
  finding,
  active,
  onToggle,
  onApply,
}: {
  segment: string;
  finding: Finding;
  active: boolean;
  onToggle: () => void;
  onApply: (suggestion: string) => void;
}) {
  const colorClass =
    finding.level === 'NG'
      ? 'bg-yakkihou-ng/20 text-yakkihou-ng decoration-yakkihou-ng'
      : finding.level === 'WARN'
        ? 'bg-yakkihou-warn/20 text-yakkihou-warn decoration-yakkihou-warn'
        : 'decoration-yakkihou-safe';

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'cursor-pointer rounded px-0.5 underline decoration-2 underline-offset-2',
          colorClass
        )}
      >
        {segment}
      </button>
      {active ? (
        <span
          role="dialog"
          className="absolute left-0 top-full z-10 mt-1 w-80 rounded-md border bg-card p-3 text-left text-xs text-card-foreground shadow-lg"
        >
          <div className="mb-1 flex items-center gap-2">
            <LevelBadge level={finding.level} />
            <span className="font-mono text-[10px] text-muted-foreground">
              L{finding.layer} · {finding.rule}
            </span>
          </div>
          <p className="mb-2 text-foreground">{finding.reason}</p>
          {finding.suggestions.length > 0 ? (
            <div>
              <p className="mb-1 text-[10px] uppercase text-muted-foreground">
                권장 대체
              </p>
              <div className="flex flex-wrap gap-1">
                {finding.suggestions.map((s, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => onApply(s)}
                    className="rounded-full border border-yakkihou-safe/40 bg-yakkihou-safe/10 px-2 py-0.5 text-yakkihou-safe hover:bg-yakkihou-safe/20"
                  >
                    → {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              (권장 대체 표현 없음 — 직접 수정 필요)
            </p>
          )}
        </span>
      ) : null}
    </span>
  );
}
