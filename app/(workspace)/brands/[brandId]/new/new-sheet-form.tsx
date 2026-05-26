'use client';

import { useState } from 'react';
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
import type { Qoo10ProductData } from '@/lib/qoo10/types';
import { cn } from '@/lib/utils';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; product: Qoo10ProductData; cached: boolean }
  | {
      status: 'error';
      message: string;
      tier?: string;
      httpStatus?: number;
    };

interface Props {
  brandId: string;
  brandName: string;
}

export function NewSheetForm({ brandId, brandName }: Props) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [showManual, setShowManual] = useState(false);

  async function importUrl(opts: { forceRefresh?: boolean } = {}) {
    if (!url.trim()) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/qoo10/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          forceRefresh: opts.forceRefresh,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({
          status: 'error',
          message: json.error ?? `HTTP ${res.status}`,
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

  async function submitManual(form: {
    title: string;
    price?: number;
    description?: string;
    category?: string;
  }) {
    if (!url.trim()) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/qoo10/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), manual: form }),
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
        <label
          htmlFor="qoo10-url"
          className="text-sm font-medium"
        >
          Qoo10 상품 URL
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          {brandName} · 일본 마켓 상품 페이지 URL을 붙여넣으세요. <code className="rounded bg-muted px-1">/g/</code> 또는 <code className="rounded bg-muted px-1">/item/</code> 형식 지원.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="qoo10-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.qoo10.jp/item/..../1200999394"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={state.status === 'loading'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') importUrl();
            }}
          />
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
          onCancel={() => setShowManual(false)}
          onSubmit={submitManual}
        />
      ) : null}

      {state.status === 'ok' ? (
        <ProductPreview
          product={state.product}
          cached={state.cached}
          brandId={brandId}
          onRefresh={() => importUrl({ forceRefresh: true })}
        />
      ) : null}
    </div>
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
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (form: {
    title: string;
    price?: number;
    description?: string;
    category?: string;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  return (
    <form
      className="rounded-md border bg-muted/30 p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const priceNum = price.trim() ? Number(price.replace(/[^\d.]/g, '')) : undefined;
        onSubmit({
          title: title.trim(),
          price: Number.isFinite(priceNum) ? priceNum : undefined,
          description: description.trim() || undefined,
          category: category.trim() || undefined,
        });
      }}
    >
      <p className="font-medium">수동 입력 폴백 (Tier 3)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Qoo10 페이지를 직접 보고 필요한 정보만 입력하세요. 시트 생성 단계에서 Claude가 학습 PDF로 빈 곳을 보강합니다.
      </p>
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
            placeholder="가격 (JPY)"
            className="w-1/2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="카테고리"
            className="w-1/2 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
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
  brandId,
  onRefresh,
}: {
  product: Qoo10ProductData;
  cached: boolean;
  brandId: string;
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
              Qoo10에서 열기
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <dl className="grid grid-cols-3 gap-3 text-xs">
            <Field label="가격">
              {product.price
                ? `¥${product.price.current.toLocaleString()}`
                : '—'}
            </Field>
            <Field label="카테고리">{product.category ?? '—'}</Field>
            <Field label="셀러">{product.seller ?? '—'}</Field>
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

      <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          다음 단계: 학습 PDF + 약기법 룰셋 결합으로 시트 초안 생성
        </p>
        <button
          type="button"
          disabled
          title="다음 단계에서 활성화"
          className={cn(
            'inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          시트 생성 (Phase 4-2)
        </button>
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
