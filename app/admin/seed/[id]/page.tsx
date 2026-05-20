import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSeedBrands, getReferenceSheet } from '@/lib/storage/local';

export const dynamic = 'force-dynamic';

export default async function ReferenceSheetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sheet = await getReferenceSheet(params.id);
  if (!sheet) notFound();

  const brands = await ensureSeedBrands();
  const brand = brands.find((b) => b.id === sheet.brandId);

  return (
    <main className="container py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/seed"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 학습 데이터 목록
        </Link>
        <h1 className="mt-2 break-all text-2xl font-bold tracking-tight">
          {sheet.fileName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {brand?.name ?? sheet.brandId} · {sheet.pages ?? '?'}p ·{' '}
          {new Date(sheet.uploadedAt).toLocaleString('ko-KR')}
        </p>

        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold">구조화 결과 (Claude)</h2>
          <pre className="overflow-auto rounded-md border bg-muted/40 p-4 text-xs">
            {JSON.stringify(sheet.structured, null, 2)}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold">원본 추출 텍스트</h2>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-xs leading-relaxed">
            {sheet.parsedText || '(빈 추출 결과)'}
          </pre>
        </section>
      </div>
    </main>
  );
}
