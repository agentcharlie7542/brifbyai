'use client';

/**
 * 상세페이지 검수 화면.
 *  [모드] 큐텐 URL 자동 캡쳐  /  이미지 직접 업로드
 *  → 검수 → 결과 탭(이미지 표기 / 추출 텍스트·수정 / 전체 수정본)
 *
 * 약기법 판정은 서버 /api/inspect 가 기존 엔진으로 수행. 여기선 입력·표시·수정만.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Loader2,
  Link2,
  Upload,
  ScanSearch,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Image as ImageIcon,
  FileText,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InspectOverlay } from '@/components/inspect-overlay';
import type { InspectBlock, InspectResult, YakkihouLevel } from '@/lib/inspect/types';

const CATEGORY_OPTIONS = [
  { value: 'health_food', label: '健康食品' },
  { value: 'cosmetic', label: '化粧品' },
  { value: 'quasi_drug', label: '医薬部外品' },
  { value: 'general_food', label: '一般食品' },
  { value: 'functional_food', label: '機能性表示食品' },
  { value: 'general', label: '一般' },
] as const;

type Mode = 'url' | 'upload';
type Tab = 'image' | 'text' | 'fix';

export function InspectClient() {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [uploads, setUploads] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('health_food');
  const [useClaude, setUseClaude] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [tab, setTab] = useState<Tab>('image');

  // 수정본 상태: blockIndex → 수정된 텍스트 (없으면 원본)
  const [edited, setEdited] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 20);
    const dataUrls = await Promise.all(
      arr.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          })
      )
    );
    setUploads((prev) => [...prev, ...dataUrls].slice(0, 20));
  }, []);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setEdited({});
    try {
      const body: Record<string, unknown> = { category, useClaude };
      if (mode === 'url') {
        if (!url.trim()) throw new Error('큐텐 상품 URL 을 입력하세요.');
        body.url = url.trim();
      } else {
        if (uploads.length === 0) throw new Error('이미지를 1장 이상 업로드하세요.');
        body.images = uploads;
      }
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      // 함수 타임아웃/크래시 시 Vercel 은 JSON 이 아닌 HTML 에러 페이지를 준다 →
      // res.json() 을 곧장 부르면 "Unexpected token 'A'" 로 터지므로 안전하게 파싱.
      const rawText = await res.text();
      let json: unknown = null;
      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        json = null;
      }
      if (!res.ok || !json) {
        if (!json) {
          if (
            res.status === 504 ||
            res.status === 500 ||
            /timeout|an error occurred|FUNCTION_INVOCATION/i.test(rawText)
          ) {
            throw new Error(
              '검수가 60초 안에 끝나지 않았습니다(상세가 길거나 서버 한도 초과). ' +
                'Layer 3 체크를 끄거나, 「이미지 직접 업로드」 모드로 나눠서 검수해 주세요.'
            );
          }
          const snippet = rawText
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160);
          throw new Error(snippet || `HTTP ${res.status}`);
        }
        const j = json as { detail?: string; error?: string };
        throw new Error(j.detail ?? j.error ?? `HTTP ${res.status}`);
      }
      setResult(json as InspectResult);
      setTab('image');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [mode, url, uploads, category, useClaude]);

  const summary = result?.summary ?? { safe: 0, warn: 0, ng: 0 };

  const blockText = useCallback(
    (idx: number, original: string) => edited[idx] ?? original,
    [edited]
  );

  const applySuggestion = useCallback(
    (idx: number, from: string, to: string) => {
      setEdited((prev) => {
        const current = prev[idx] ?? (result?.blocks[idx]?.text ?? '');
        return { ...prev, [idx]: current.replace(from, to) };
      });
    },
    [result]
  );

  const applyAll = useCallback(() => {
    if (!result) return;
    const next: Record<number, string> = {};
    result.blocks.forEach((b, idx) => {
      let t = b.text;
      for (const f of b.findings) {
        if (f.suggestions.length > 0) t = t.replace(f.text, f.suggestions[0]);
      }
      if (t !== b.text) next[idx] = t;
    });
    setEdited(next);
  }, [result]);

  const correctedText = useMemo(() => {
    if (!result) return '';
    return result.blocks
      .map((b, idx) => blockText(idx, b.text))
      .filter((t) => t.trim().length > 0)
      .join('\n');
  }, [result, blockText]);

  const copyCorrected = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(correctedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('클립보드 복사에 실패했습니다.');
    }
  }, [correctedText]);

  const canRun = mode === 'url' ? url.trim().length > 0 : uploads.length > 0;
  const flaggedBlocks = result?.blocks.filter((b) => b.findings.length > 0) ?? [];

  return (
    <div className="space-y-6">
      {/* 모드 토글 */}
      <div className="inline-flex rounded-md border bg-muted/30 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5',
            mode === 'url' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
          )}
        >
          <Link2 className="h-4 w-4" /> 큐텐 URL 자동 캡쳐
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5',
            mode === 'upload' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
          )}
        >
          <Upload className="h-4 w-4" /> 이미지 직접 업로드
        </button>
      </div>

      {/* 입력 */}
      <div className="rounded-lg border bg-card p-4">
        {mode === 'url' ? (
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              큐텐 상품 URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.qoo10.jp/g/1031167095"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              상세페이지를 헤드리스 브라우저로 캡쳐해 이미지의 텍스트를 OCR 합니다.
              대기열·차단 시 업로드 모드를 사용하세요.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              상세페이지 이미지 (최대 20장)
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => onFiles(e.target.files)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {uploads.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {uploads.map((u, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u}
                      alt={`업로드 ${i + 1}`}
                      className="h-16 w-16 rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setUploads((p) => p.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              商品カテゴリ (상품 종류)
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
            Layer 3 (Claude 정밀 판정)
          </label>
          <Button onClick={runScan} disabled={loading || !canRun} className="ml-auto">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 검수 중…
              </>
            ) : (
              <>
                <ScanSearch className="mr-2 h-4 w-4" /> 검수 시작
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {mode === 'url'
            ? '상세페이지 캡쳐 → OCR → 약기법 판정 중입니다. 20~40초 정도 걸릴 수 있습니다.'
            : '이미지 OCR → 약기법 판정 중입니다.'}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-yakkihou-ng/40 bg-yakkihou-ng/10 px-4 py-3 text-sm text-yakkihou-ng">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          {/* 요약 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
            <div className="flex items-center gap-4 text-sm">
              <Pill icon={<CheckCircle2 className="h-3.5 w-3.5" />} count={summary.safe} kind="safe" label="문제없음 블록" />
              <Pill icon={<AlertTriangle className="h-3.5 w-3.5" />} count={summary.warn} kind="warn" label="WARN" />
              <Pill icon={<XCircle className="h-3.5 w-3.5" />} count={summary.ng} kind="ng" label="NG" />
            </div>
            <span className="text-xs text-muted-foreground">
              이미지 {result.meta.imageCount} · 블록 {result.meta.blockCount} ·{' '}
              {result.meta.capture === 'screenshot' ? '자동 캡쳐' : '업로드'} ·{' '}
              {result.meta.layer3 ? 'L3 ON' : 'L1·L2'}
            </span>
          </div>

          {/* 부분 검수 경고: 60s 한도로 일부 이미지를 OCR 검수하지 못함 */}
          {result.meta.partial ? (
            <div className="rounded-md border border-yakkihou-warn/40 bg-yakkihou-warn/10 px-4 py-2.5 text-xs text-yakkihou-warn">
              ⏳ 상세가 길어 {result.meta.pendingImages.length}장(캡쳐{' '}
              {result.meta.pendingImages.map((i) => i + 1).join(', ')})은 60초 한도 안에 검수하지
              못했습니다. <span className="font-medium">Layer 3 체크를 끄거나</span> 「이미지 직접
              업로드」 모드로 나눠서 검수하면 전부 확인할 수 있습니다.
            </div>
          ) : null}

          {/* 탭 */}
          <div className="flex gap-1 border-b text-sm">
            <TabButton active={tab === 'image'} onClick={() => setTab('image')} icon={<ImageIcon className="h-4 w-4" />}>
              이미지 표기
            </TabButton>
            <TabButton active={tab === 'text'} onClick={() => setTab('text')} icon={<FileText className="h-4 w-4" />}>
              추출 텍스트 · 수정
            </TabButton>
            <TabButton active={tab === 'fix'} onClick={() => setTab('fix')} icon={<Wand2 className="h-4 w-4" />}>
              전체 수정본
            </TabButton>
          </div>

          {/* 탭: 이미지 표기 */}
          {tab === 'image' ? (
            result.images.length > 0 ? (
              <div className="space-y-4">
                {result.images.map((img, idx) => (
                  <div key={idx}>
                    <p className="mb-1 text-xs text-muted-foreground">
                      캡쳐 {idx + 1}
                      {result.meta.pendingImages.includes(idx) ? (
                        <span className="ml-2 font-medium text-yakkihou-warn">
                          ⏳ 시간 초과 — 미검수
                        </span>
                      ) : null}
                    </p>
                    <InspectOverlay image={img} blocks={result.blocks} imageIndex={idx} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">표시할 이미지가 없습니다.</p>
            )
          ) : null}

          {/* 탭: 추출 텍스트 · 수정 */}
          {tab === 'text' ? (
            <div className="space-y-3">
              {flaggedBlocks.length === 0 ? (
                <p className="rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground">
                  약기법 위반 소지가 발견되지 않았습니다. (룰셋 기준
                  {result.meta.layer3 ? ' + Claude 판정' : ''})
                </p>
              ) : (
                result.blocks.map((b, idx) =>
                  b.findings.length > 0 ? (
                    <BlockRow
                      key={idx}
                      index={idx}
                      block={b}
                      onApply={(from, to) => applySuggestion(idx, from, to)}
                      editedText={edited[idx]}
                    />
                  ) : null
                )
              )}
            </div>
          ) : null}

          {/* 탭: 전체 수정본 */}
          {tab === 'fix' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={applyAll}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> 모든 권장 표현 적용
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEdited({})}>
                  원본으로 되돌리기
                </Button>
                <Button size="sm" onClick={copyCorrected} className="ml-auto">
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> 복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> 수정본 복사
                    </>
                  )}
                </Button>
              </div>
              <textarea
                readOnly
                value={correctedText}
                rows={Math.min(30, Math.max(8, correctedText.split('\n').length + 1))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed shadow-sm outline-none"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 블록 텍스트를 finding 하이라이트 + 수정 칩과 함께 렌더. */
function BlockRow({
  index,
  block,
  onApply,
  editedText,
}: {
  index: number;
  block: InspectBlock;
  onApply: (from: string, to: string) => void;
  editedText?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <LevelBadge level={block.level} />
        <span className="text-[11px] text-muted-foreground">캡쳐 {block.imageIndex + 1}</span>
      </div>
      <p className="font-mono leading-relaxed">{renderHighlighted(block)}</p>
      {editedText && editedText !== block.text ? (
        <p className="mt-1 font-mono text-xs leading-relaxed text-yakkihou-safe">
          → {editedText}
        </p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {block.findings.map((f, j) => (
          <li key={j} className="text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{f.text}</span> · L{f.layer}{' '}
              {f.rule} — {f.reason}
            </span>
            {f.suggestions.length > 0 ? (
              <span className="ml-1 inline-flex flex-wrap gap-1">
                {f.suggestions.map((s, k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onApply(f.text, s)}
                    className="rounded-full border border-yakkihou-safe/40 bg-yakkihou-safe/10 px-2 py-0.5 text-yakkihou-safe hover:bg-yakkihou-safe/20"
                  >
                    → {s}
                  </button>
                ))}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 블록 텍스트에서 finding 구간을 색칠. startIndex/endIndex 는 블록 기준 오프셋. */
function renderHighlighted(block: InspectBlock) {
  const text = block.text;
  const sorted = [...block.findings]
    .filter((f) => f.endIndex > f.startIndex && f.endIndex <= text.length)
    .sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex);

  // overlap 제거: NG > WARN 우선
  const picked: typeof sorted = [];
  let lastEnd = -1;
  for (const f of sorted) {
    if (f.startIndex >= lastEnd) {
      picked.push(f);
      lastEnd = f.endIndex;
    }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  picked.forEach((f, i) => {
    if (cursor < f.startIndex) nodes.push(<span key={`p${i}`}>{text.slice(cursor, f.startIndex)}</span>);
    nodes.push(
      <span
        key={`f${i}`}
        title={f.reason}
        className={cn(
          'rounded px-0.5 underline decoration-2 underline-offset-2',
          f.level === 'NG'
            ? 'bg-yakkihou-ng/20 text-yakkihou-ng decoration-yakkihou-ng'
            : 'bg-yakkihou-warn/20 text-yakkihou-warn decoration-yakkihou-warn'
        )}
      >
        {text.slice(f.startIndex, f.endIndex)}
      </span>
    );
    cursor = f.endIndex;
  });
  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  return nodes;
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2',
        active
          ? 'border-primary font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {children}
    </button>
  );
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

function LevelBadge({ level }: { level: YakkihouLevel }) {
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
