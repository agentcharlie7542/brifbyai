'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import type { Qoo10ProductData, ProductSource } from '@/lib/qoo10/types';
import { cn } from '@/lib/utils';
import { RAW_SNIPPET, BOOKMARKLET_URL } from '@/lib/oliveyoung/snippet';

interface ManualForm {
  title: string;
  price?: number;
  description?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
}

/**
 * URL 호스트만 보고 Qoo10 / 올리브영을 자동 분기.
 * 매칭 실패시 null → 사용자에게 "지원하지 않는 URL" 에러 노출.
 */
function detectSource(url: string): ProductSource | null {
  const t = url.trim();
  if (!t) return null;
  if (/(?:^|\/\/|www\.)?qoo10\.jp/i.test(t)) return 'qoo10';
  if (/(?:^|\/\/|www\.|m\.)?oliveyoung\.co\.kr/i.test(t)) return 'oliveyoung';
  return null;
}

function formatPrice(p: NonNullable<Qoo10ProductData['price']>): string {
  if (p.currency === 'KRW') return `₩${p.current.toLocaleString()}`;
  return `¥${p.current.toLocaleString()}`;
}

const SOURCE_LABEL: Record<ProductSource, string> = {
  qoo10: 'Qoo10 Japan',
  oliveyoung: '올리브영',
};

const CATEGORIES = [
  { value: 'cosmetic', label: '화장품' },
  { value: 'quasi_drug', label: '의약부외품' },
  { value: 'health_food', label: '건강식품' },
  { value: 'functional_food', label: '기능성표시식품' },
  { value: 'general_food', label: '일반식품' },
  { value: 'medical_device', label: '의료기기' },
  { value: 'general', label: '일반' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

type GenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; detail?: string };

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; product: Qoo10ProductData; cached: boolean }
  | {
      status: 'error';
      message: string;
      detail?: string;
      tier?: string;
      httpStatus?: number;
    };

interface Props {
  brandId: string;
  brandName: string;
}

export function NewSheetForm({ brandId, brandName }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [showManual, setShowManual] = useState(false);

  const detected = useMemo(() => detectSource(url), [url]);

  function endpointFor(source: ProductSource): string {
    return source === 'oliveyoung'
      ? '/api/oliveyoung/import'
      : '/api/qoo10/import';
  }

  async function importUrl(opts: { forceRefresh?: boolean } = {}) {
    const trimmed = url.trim();
    if (!trimmed) return;
    const source = detectSource(trimmed);
    if (!source) {
      setState({
        status: 'error',
        message:
          '지원하지 않는 URL 입니다. Qoo10(qoo10.jp) 또는 올리브영(oliveyoung.co.kr) 상품 URL 을 입력하세요.',
      });
      return;
    }
    setState({ status: 'loading' });
    try {
      const res = await fetch(endpointFor(source), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          forceRefresh: opts.forceRefresh,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({
          status: 'error',
          message: json.error ?? `HTTP ${res.status}`,
          detail: json.detail,
          tier: json.tier,
          httpStatus: res.status,
        });
        return;
      }
      setState({
        status: 'ok',
        product: json.product as Qoo10ProductData,
        cached: Boolean(json.cached),
      });
      setShowManual(false);
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'fetch failed',
      });
    }
  }

  async function submitManual(form: ManualForm) {
    const trimmed = url.trim();
    if (!trimmed) return;
    const source = detectSource(trimmed);
    if (!source) {
      setState({
        status: 'error',
        message:
          '지원하지 않는 URL 입니다. Qoo10 또는 올리브영 상품 URL 을 입력하세요.',
      });
      return;
    }
    setState({ status: 'loading' });
    try {
      const res = await fetch(endpointFor(source), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed, manual: form }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({
          status: 'error',
          message: json.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setState({
        status: 'ok',
        product: json.product as Qoo10ProductData,
        cached: false,
      });
      setShowManual(false);
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'manual import failed',
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <label htmlFor="source-url" className="text-sm font-medium">
          상품 페이지 URL
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          {brandName} ·{' '}
          <span className="font-medium text-foreground">Qoo10 Japan</span> 또는{' '}
          <span className="font-medium text-foreground">올리브영</span> 상품 URL 을 붙여넣으세요.
          <br />
          예) <code className="rounded bg-muted px-1">https://www.qoo10.jp/g/1200999394</code>
          {' / '}
          <code className="rounded bg-muted px-1">
            https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000247884
          </code>
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="source-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Qoo10 또는 올리브영 상품 URL"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={state.status === 'loading'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') importUrl();
            }}
          />
          {detected ? (
            <span className="inline-flex items-center self-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {SOURCE_LABEL[detected]} 감지됨
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => importUrl()}
            disabled={state.status === 'loading' || !url.trim()}
            className="inline-flex items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow disabled:opacity-50"
          >
            {state.status === 'loading' ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                가져오는 중
              </>
            ) : (
              <>
                <Search className="mr-1.5 h-4 w-4" />
                가져오기
              </>
            )}
          </button>
        </div>
      </section>

      {state.status === 'error' ? (
        <ErrorPanel
          state={state}
          onRetry={() => importUrl({ forceRefresh: true })}
          onManual={() => setShowManual(true)}
        />
      ) : null}

      {showManual ? (
        <ManualPanel
          source={detected}
          onCancel={() => setShowManual(false)}
          onSubmit={submitManual}
        />
      ) : null}

      {state.status === 'ok' ? (
        <>
          <ProductPreview
            product={state.product}
            cached={state.cached}
            onRefresh={() => importUrl({ forceRefresh: true })}
          />
          <GenerateSheetSection
            brandId={brandId}
            qoo10Url={url.trim()}
            defaultCampaign={state.product.title.slice(0, 80)}
            onCreated={(id) => router.push(`/brands/${brandId}/sheets/${id}`)}
          />
        </>
      ) : null}
    </div>
  );
}

function GenerateSheetSection({
  brandId,
  qoo10Url,
  defaultCampaign,
  onCreated,
}: {
  brandId: string;
  qoo10Url: string;
  defaultCampaign: string;
  onCreated: (sheetId: string) => void;
}) {
  const [category, setCategory] = useState<CategoryValue | ''>('');
  const [campaignName, setCampaignName] = useState(defaultCampaign);
  const [state, setState] = useState<GenState>({ status: 'idle' });

  async function generate() {
    if (!category) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/sheets/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brandId,
          qoo10Url,
          category,
          campaignName: campaignName.trim() || undefined,
        }),
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        throw new Error(
          res.status === 504 || res.status >= 500
            ? '서버 처리 시간 초과(60s) — 학습 PDF 가 많거나 Claude 가 느린 케이스입니다.'
            : `예상치 못한 응답 (HTTP ${res.status})`
        );
      }
      const json = await res.json();
      if (!res.ok) {
        setState({
          status: 'error',
          message: json.error ?? `HTTP ${res.status}`,
          detail: json.detail,
        });
        return;
      }
      onCreated(json.id as string);
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">시트 초안 생성</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            카테고리·캠페인명을 정하면 학습 PDF + 약기법 룰셋과 합쳐 Claude 가 시트 초안을 만듭니다. 보통 10~30초 소요.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
        <div>
          <label className="text-xs font-medium" htmlFor="sheet-category">
            제품 카테고리 (약기법 룰셋)
          </label>
          <select
            id="sheet-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryValue | '')}
            disabled={state.status === 'loading'}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          >
            <option value="">선택…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium" htmlFor="sheet-campaign">
            캠페인명
          </label>
          <input
            id="sheet-campaign"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            disabled={state.status === 'loading'}
            placeholder="예) Pureka 인플루언서 런칭"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

      {state.status === 'error' ? (
        <div className="mt-3 rounded-md border border-yakkihou-ng/30 bg-yakkihou-ng/5 p-3 text-xs">
          <p className="font-medium text-yakkihou-ng">생성 실패</p>
          <p className="mt-0.5 text-foreground/80">{state.message}</p>
          {state.detail ? (
            <p className="mt-0.5 break-all text-[10px] text-foreground/60">
              {state.detail}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {category
            ? `${CATEGORIES.find((c) => c.value === category)?.label} 룰셋으로 검증합니다.`
            : '카테고리를 먼저 선택하세요.'}
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={!category || state.status === 'loading'}
          className={cn(
            'inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {state.status === 'loading' ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              생성 중 (Claude 호출)…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              시트 생성
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function ErrorPanel({
  state,
  onRetry,
  onManual,
}: {
  state: Extract<State, { status: 'error' }>;
  onRetry: () => void;
  onManual: () => void;
}) {
  return (
    <div className="rounded-md border border-yakkihou-ng/30 bg-yakkihou-ng/5 p-4 text-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 text-yakkihou-ng" />
        <div className="flex-1">
          <p className="font-medium text-yakkihou-ng">가져오기 실패</p>
          <p className="mt-1 text-xs text-foreground/80">{state.message}</p>
          {state.detail ? (
            <p className="mt-1 break-all text-[10px] text-foreground/60">
              {state.detail}
            </p>
          ) : null}
          {state.httpStatus ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              HTTP {state.httpStatus} · tier {state.tier ?? '-'}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm hover:bg-accent"
        >
          <RefreshCw className="mr-1.5 h-3 w-3" />
          다시 시도
        </button>
        <button
          type="button"
          onClick={onManual}
          className="inline-flex items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          수동 입력 폴백
        </button>
      </div>
    </div>
  );
}

function ManualPanel({
  source,
  onCancel,
  onSubmit,
}: {
  source: ProductSource | null;
  onCancel: () => void;
  onSubmit: (form: ManualForm) => void;
}) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pasteJson, setPasteJson] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOliveYoung = source === 'oliveyoung';
  const priceLabel = isOliveYoung ? '가격 (KRW)' : '가격 (JPY)';

  /** 북마클릿/콘솔 스니펫 결과 JSON 을 폼 필드로 펼친다. */
  function applyJson(raw: string) {
    setPasteError(null);
    const trimmed = raw.trim();
    if (!trimmed) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setPasteError('JSON 파싱 실패 — 스니펫 출력이 맞는지 확인하세요.');
      return;
    }
    const get = (k: string): string | undefined => {
      const v = parsed[k];
      return typeof v === 'string' ? v : undefined;
    };
    const num = (k: string): string => {
      const v = parsed[k];
      return typeof v === 'number' ? String(v) : '';
    };
    if (get('title')) setTitle(get('title') as string);
    if (get('brand')) setBrand(get('brand') as string);
    if (get('description')) setDescription(get('description') as string);
    if (get('category')) setCategory(get('category') as string);
    if (get('imageUrl')) setImageUrl(get('imageUrl') as string);
    const priceStr = num('price');
    if (priceStr) setPrice(priceStr);
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(RAW_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form
      className="rounded-md border bg-muted/30 p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const priceNum = price.trim()
          ? Number(price.replace(/[^\d.]/g, ''))
          : undefined;
        onSubmit({
          title: title.trim(),
          price: Number.isFinite(priceNum) ? priceNum : undefined,
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          brand: brand.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        });
      }}
    >
      <p className="font-medium">수동 입력 폴백 (Tier 3)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {isOliveYoung
          ? '올리브영은 Vercel IP 를 WAF 가 차단합니다. 아래 두 가지 중 하나로 진행하세요.'
          : 'Qoo10 페이지를 직접 보고 필요한 정보만 입력하세요.'}{' '}
        시트 생성 단계에서 Claude 가 학습 PDF 로 빈 곳을 보강합니다.
      </p>

      {isOliveYoung ? (
        <div className="mt-4 rounded-md border border-dashed bg-background p-3 text-xs">
          <p className="font-medium text-foreground">
            방법 1 · 북마클릿/콘솔 스니펫으로 자동 채우기 (권장)
          </p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-foreground/80">
            <li>
              올리브영 상품 페이지를 본인 브라우저에서 열어 둔 상태로 유지
            </li>
            <li>
              아래 코드를 복사 → DevTools 콘솔에 붙여넣고 실행{' '}
              <span className="text-muted-foreground">
                (또는 북마클릿 링크를 즐겨찾기에 드래그 후 한 번 클릭)
              </span>
            </li>
            <li>상품 데이터 JSON 이 클립보드에 복사됨</li>
            <li>아래 ⬇ 텍스트 영역에 붙여넣으면 폼이 자동 채워집니다</li>
          </ol>

          <div className="mt-2 flex items-center gap-2">
            <a
              href={BOOKMARKLET_URL}
              onClick={(e) => e.preventDefault()}
              draggable
              className="inline-flex items-center rounded border border-input bg-muted px-2 py-1 text-[11px] font-medium hover:bg-accent"
              title="이 링크를 브라우저 즐겨찾기 바에 드래그하세요"
            >
              📎 brifbyai · 올리브영 추출
            </a>
            <span className="text-[10px] text-muted-foreground">
              ← 즐겨찾기로 드래그하세요 (북마클릿)
            </span>
          </div>

          <div className="mt-2 rounded bg-muted/60 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                콘솔 스니펫
              </span>
              <button
                type="button"
                onClick={copySnippet}
                className="rounded border border-input bg-background px-2 py-0.5 text-[10px] hover:bg-accent"
              >
                {copied ? '복사됨 ✓' : '코드 복사'}
              </button>
            </div>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-snug text-foreground/80">
              {RAW_SNIPPET}
            </pre>
          </div>

          <label className="mt-3 block">
            <span className="text-[11px] font-medium">
              ⬇ 여기에 스니펫 결과 JSON 붙여넣기 (자동 채움)
            </span>
            <textarea
              value={pasteJson}
              onChange={(e) => {
                setPasteJson(e.target.value);
                applyJson(e.target.value);
              }}
              placeholder={'{\n  "title": "...",\n  "price": 12000,\n  ...\n}'}
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-[11px]"
            />
            {pasteError ? (
              <span className="mt-1 block text-[10px] text-yakkihou-ng">
                {pasteError}
              </span>
            ) : null}
          </label>

          <p className="mt-3 border-t pt-2 text-foreground">
            방법 2 · 직접 입력
          </p>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="상품명 (필수)"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={priceLabel}
            className="w-1/2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="카테고리"
            className="w-1/2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        {isOliveYoung ? (
          <div className="flex gap-2">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="브랜드"
              className="w-1/2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="대표 이미지 URL"
              className="w-1/2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
        ) : null}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-input px-3 py-1.5 text-xs"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          이 데이터로 진행
        </button>
      </div>
    </form>
  );
}

function ProductPreview({
  product,
  cached,
  onRefresh,
}: {
  product: Qoo10ProductData;
  cached: boolean;
  onRefresh: () => void;
}) {
  const hero = product.images?.[0];
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-yakkihou-safe" />
          <span className="font-medium">상품 정보 가져옴</span>
          <TierBadge method={product.fetchMethod} />
          {cached ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              cached
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          title="Qoo10 다시 fetch (캐시 무시)"
          className="inline-flex items-center rounded px-2 py-0.5 text-[10px] hover:bg-accent"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          새로고침
        </button>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[180px_1fr]">
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
          {hero ? (
            <Image
              src={hero}
              alt={product.title}
              fill
              sizes="180px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              이미지 없음
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold leading-snug">
              {product.title}
            </h2>
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              {product.source === 'oliveyoung' ? '올리브영' : 'Qoo10'}에서 열기
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <dl className="grid grid-cols-3 gap-3 text-xs">
            <Field label="가격">
              {product.price ? formatPrice(product.price) : '—'}
            </Field>
            <Field label="카테고리">{product.category ?? '—'}</Field>
            <Field label={product.source === 'oliveyoung' ? '브랜드' : '셀러'}>
              {product.brand ?? product.seller ?? '—'}
            </Field>
          </dl>

          {product.description ? (
            <Field label="설명" full>
              <p className="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-foreground/80">
                {product.description}
              </p>
            </Field>
          ) : null}

          {product.features && product.features.length > 0 ? (
            <Field label="특장점" full>
              <ul className="space-y-0.5 text-xs text-foreground/80">
                {product.features.slice(0, 8).map((f, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
        </div>
      </div>

    </section>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'col-span-3' : undefined}>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function TierBadge({ method }: { method: Qoo10ProductData['fetchMethod'] }) {
  const label =
    method === 'tier1'
      ? 'Tier 1 fetch'
      : method === 'tier2'
        ? 'Tier 2 (Playwright)'
        : '수동 입력';
  const tone =
    method === 'tier1'
      ? 'bg-yakkihou-safe/15 text-yakkihou-safe'
      : method === 'tier3_manual'
        ? 'bg-yakkihou-warn/15 text-yakkihou-warn'
        : 'bg-muted text-muted-foreground';
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', tone)}>
      {label}
    </span>
  );
}
