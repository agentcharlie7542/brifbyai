'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  CheckCircle2,
  FileUp,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Status =
  | 'queued'
  | 'uploading'
  | 'parsing'
  | 'retrying'
  | 'done'
  | 'error';

interface FileItem {
  file: File;
  status: Status;
  message?: string;
  attempts?: number;
  result?: {
    id: string;
    pages?: number;
  };
}

const MAX_AUTO_ATTEMPTS = 2;

export function PdfUploader({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setUploading] = useState(false);

  const summary = useMemo(() => {
    const done = items.filter((i) => i.status === 'done').length;
    const failed = items.filter((i) => i.status === 'error').length;
    const pending = items.filter(
      (i) =>
        i.status === 'queued' ||
        i.status === 'uploading' ||
        i.status === 'parsing' ||
        i.status === 'retrying'
    ).length;
    return { done, failed, pending, total: items.length };
  }, [items]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...pdfs.map<FileItem>((file) => ({ file, status: 'queued' })),
    ]);
  }, []);

  async function uploadAll() {
    setUploading(true);
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].status !== 'queued') continue;
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(i);
    }
    setUploading(false);
    router.refresh();
  }

  async function retryOne(index: number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, status: 'queued', message: undefined } : it
      )
    );
    await uploadOne(index);
    router.refresh();
  }

  async function uploadOne(index: number) {
    const file = items[index].file;
    for (let attempt = 1; attempt <= MAX_AUTO_ATTEMPTS; attempt += 1) {
      const isRetry = attempt > 1;
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                status: isRetry ? 'retrying' : 'uploading',
                attempts: attempt,
              }
            : it
        )
      );

      try {
        // 1) PDF 바이트를 Vercel Blob 으로 클라이언트에서 직접 업로드
        //    (Vercel 함수 4.5MB body 제한을 우회)
        const blob = await upload(`reference-sheets/${brandId}/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/pdf/upload-token',
          contentType: 'application/pdf',
          clientPayload: JSON.stringify({ brandId }),
        });

        // 2) Blob URL 만 함수로 보내서 파싱 + Claude 구조화 + DB 저장
        setItems((prev) =>
          prev.map((it, i) => (i === index ? { ...it, status: 'parsing' } : it))
        );

        const res = await fetch('/api/pdf/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            brandId,
            blobUrl: blob.url,
            fileName: file.name,
          }),
        });

        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('application/json')) {
          throw new Error(
            res.status === 504 || res.status >= 500
              ? '서버 처리 시간 초과(60s) — 매우 긴 PDF 입니다.'
              : `예상치 못한 응답 (HTTP ${res.status})`
          );
        }

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);
        }

        setItems((prev) =>
          prev.map((it, i) =>
            i === index
              ? {
                  ...it,
                  status: 'done',
                  result: { id: json.id, pages: json.pages },
                  message: undefined,
                }
              : it
          )
        );
        router.refresh();
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'upload failed';
        const isLast = attempt === MAX_AUTO_ATTEMPTS;
        if (isLast) {
          setItems((prev) =>
            prev.map((it, i) =>
              i === index ? { ...it, status: 'error', message } : it
            )
          );
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        업로드 대상 브랜드 ·{' '}
        <span className="font-medium text-foreground">{brandName}</span>
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          dragging
            ? 'border-yakkihou-safe bg-yakkihou-safe/5'
            : 'border-input bg-muted/30'
        )}
      >
        <FileUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm">
          PDF를 이 영역에 끌어다 놓거나{' '}
          <label className="cursor-pointer font-medium text-primary underline">
            파일 선택
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          서버 측에서 pdf-parse + Claude 로 자동 구조화됩니다. 실패 시 자동 1회
          재시도.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {summary.total}개 파일 · 완료 {summary.done} / 실패{' '}
              {summary.failed}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setItems([])}
                disabled={isUploading}
                className="rounded-md border border-input px-3 py-1.5 text-xs shadow-sm hover:bg-accent disabled:opacity-50"
              >
                목록 비우기
              </button>
              <button
                type="button"
                onClick={uploadAll}
                disabled={isUploading || summary.pending === 0}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    업로드 중
                  </>
                ) : (
                  '업로드 시작'
                )}
              </button>
            </div>
          </div>

          <ul className="divide-y rounded-md border bg-card">
            {items.map((it, i) => (
              <li
                key={`${it.file.name}-${i}`}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <StatusIcon status={it.status} />
                <span className="flex-1 truncate" title={it.file.name}>
                  {it.file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(it.file.size / 1024).toFixed(0)} KB
                </span>
                {it.result?.pages ? (
                  <span className="text-xs text-muted-foreground">
                    {it.result.pages}p
                  </span>
                ) : null}
                {it.status === 'error' && it.message ? (
                  <>
                    <span
                      className="max-w-xs truncate text-xs text-yakkihou-ng"
                      title={it.message}
                    >
                      {it.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => retryOne(i)}
                      disabled={isUploading}
                      className="inline-flex items-center rounded border border-input px-2 py-0.5 text-[10px] hover:bg-accent disabled:opacity-50"
                      title="다시 시도"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      재시도
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  switch (status) {
    case 'queued':
      return <span className="h-4 w-4 rounded-full bg-muted" aria-hidden />;
    case 'uploading':
    case 'parsing':
    case 'retrying':
      return (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      );
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-yakkihou-safe" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-yakkihou-ng" />;
  }
}
