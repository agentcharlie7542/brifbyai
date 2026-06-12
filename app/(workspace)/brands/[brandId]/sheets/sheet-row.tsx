'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Trash2 } from 'lucide-react';

interface YakkihouSummary {
  safe: number;
  warn: number;
  ng: number;
}

interface Props {
  brandId: string;
  sheetId: string;
  campaignName: string;
  category: string;
  targetMarket: string;
  yakkihouSummary: YakkihouSummary | null;
  updatedAt: string; // ISO
}

export function SheetRow({
  brandId,
  sheetId,
  campaignName,
  category,
  targetMarket,
  yakkihouSummary,
  updatedAt,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sheets/${sheetId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `삭제 실패 (HTTP ${res.status})`);
        setDeleting(false);
        return;
      }
      // 서버 컴포넌트(목록 페이지) 가 다시 fetch 되도록 라우터 refresh
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 중 오류');
      setDeleting(false);
    }
  }

  return (
    <li className="relative">
      <div className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
        <Link
          href={`/brands/${brandId}/sheets/${sheetId}`}
          className="flex flex-1 items-center gap-3 min-w-0"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{campaignName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {category} · {targetMarket.toUpperCase()}
            </p>
          </div>
          {yakkihouSummary ? (
            <div className="flex gap-2 text-xs">
              <span className="text-yakkihou-safe">
                SAFE {yakkihouSummary.safe}
              </span>
              <span className="text-yakkihou-warn">
                WARN {yakkihouSummary.warn}
              </span>
              <span className="text-yakkihou-ng">NG {yakkihouSummary.ng}</span>
            </div>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {new Date(updatedAt).toLocaleDateString('ko-KR')}
          </span>
        </Link>

        {confirming ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-yakkihou-ng">삭제할까요?</span>
            <button
              type="button"
              onClick={performDelete}
              disabled={deleting}
              className="inline-flex items-center rounded bg-yakkihou-ng px-2 py-1 text-xs font-medium text-white shadow-sm disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                '예, 삭제'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={deleting}
              className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title="이 시트 삭제"
            className="rounded p-1.5 text-muted-foreground hover:bg-yakkihou-ng/10 hover:text-yakkihou-ng"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {error ? (
        <p className="border-t border-yakkihou-ng/30 bg-yakkihou-ng/5 px-4 py-1.5 text-xs text-yakkihou-ng">
          {error}
        </p>
      ) : null}
    </li>
  );
}
