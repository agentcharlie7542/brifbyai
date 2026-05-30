'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Users, ArrowRight } from 'lucide-react';

interface InfluencerOpt {
  id: string;
  handle: string;
  displayName: string | null;
  platform: string;
  hasPersona: boolean;
}

interface ProposalItem {
  id: string;
  influencerName: string | null;
  influencerHandle: string | null;
  influencerPlatform: string | null;
  status: string;
  yakkihouSummary: { safe: number; warn: number; ng: number } | null;
  updatedAt: string;
}

export function SheetProposals({
  brandId,
  sheetId,
  influencers,
  proposals,
}: {
  brandId: string;
  sheetId: string;
  influencers: InfluencerOpt[];
  proposals: ProposalItem[];
}) {
  const router = useRouter();
  const [influencerId, setInfluencerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!influencerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sheets/${sheetId}/proposals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ influencerId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.detail || json.error || `HTTP ${res.status}`);
        return;
      }
      router.push(`/brands/${brandId}/sheets/${sheetId}/proposals/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" />
            인플루언서 맞춤 제안
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            이 표준 시트를 개별 인플루언서의 보이스·포맷으로 재구성합니다.
          </p>
        </div>
        <Link
          href={`/brands/${brandId}/influencers`}
          className="text-xs text-primary hover:underline"
        >
          인플루언서 관리 →
        </Link>
      </div>

      {/* 생성 컨트롤 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={influencerId}
          onChange={(e) => setInfluencerId(e.target.value)}
          disabled={busy || influencers.length === 0}
          className="min-w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">
            {influencers.length === 0
              ? '등록된 인플루언서 없음'
              : '인플루언서 선택…'}
          </option>
          {influencers.map((i) => (
            <option key={i.id} value={i.id}>
              {(i.displayName || i.handle) + ` (${i.platform})`}
              {i.hasPersona ? '' : ' · 미분석'}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={busy || !influencerId}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              생성 중…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              맞춤 제안 생성
            </>
          )}
        </button>
        {influencers.length === 0 ? (
          <Link
            href={`/brands/${brandId}/influencers`}
            className="text-xs text-primary hover:underline"
          >
            먼저 인플루언서 추가하기
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 break-all text-xs text-yakkihou-ng">{error}</p>
      ) : null}

      {/* 기존 제안 목록 */}
      <div className="mt-6">
        {proposals.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            아직 생성된 맞춤 제안이 없습니다.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/brands/${brandId}/sheets/${sheetId}/proposals/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">
                      {p.influencerName || p.influencerHandle || '(삭제된 인플루언서)'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.influencerPlatform ?? '-'} · {p.status} ·{' '}
                      {new Date(p.updatedAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  {p.yakkihouSummary ? (
                    <span className="flex gap-2 text-xs">
                      <span className="text-yakkihou-safe">
                        S {p.yakkihouSummary.safe}
                      </span>
                      <span className="text-yakkihou-warn">
                        W {p.yakkihouSummary.warn}
                      </span>
                      <span className="text-yakkihou-ng">
                        N {p.yakkihouSummary.ng}
                      </span>
                    </span>
                  ) : null}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
