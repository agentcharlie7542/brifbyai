'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'queued' | 'uploading' | 'done' | 'error';

interface FileItem {
  file: File;
  status: Status;
  message?: string;
  result?: {
    id: string;
    pages?: number;
  };
}

export function PdfUploader({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setUploading] = useState(false);

  const summary = useMemo(() => {
    const done = items.filter((i) => i.status === 'done').length;
    const failed = items.filter((i) => i.status === 'error').length;
    const pending = items.filter(
      (i) => i.status === 'queued' || i.status === 'uploading'
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
  }

  async function uploadOne(index: number) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, status: 'uploading' } : it))
    );
    const fd = new FormData();
    fd.append('brandId', brandId);
    fd.append('file', items[index].file);

    try {
      const res = await fetch('/api/pdf/import', { method: 'POST', body: fd });
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
              }
            : it
        )
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                status: 'error',
                message: err instanceof Error ? err.message : 'upload failed',
              }
            : it
        )
      );
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
          서버 측에서 pdf-parse + Claude 로 자동 구조화됩니다.
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
                  <span
                    className="max-w-xs truncate text-xs text-yakkihou-ng"
                    title={it.message}
                  >
                    {it.message}
                  </span>
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
      return (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      );
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-yakkihou-safe" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-yakkihou-ng" />;
  }
}
