import Link from 'next/link';
import { PdfUploader } from '@/components/pdf-uploader';
import {
  ensureSeedBrands,
  listReferenceSheets,
} from '@/lib/storage/local';

export const dynamic = 'force-dynamic';

export default async function AdminSeedPage() {
  const brands = await ensureSeedBrands();
  const recent = (await listReferenceSheets()).slice(0, 10);
  const brandById = new Map(brands.map((b) => [b.id, b]));

  return (
    <main className="container py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">
          PDF 학습 데이터 업로드
        </h1>
        <p className="mt-3 text-muted-foreground">
          과거 오리엔트시트 PDF를 일괄 업로드하면 Claude 가 필드별로 구조화해
          저장합니다. Phase 2 이후 RAG 컨텍스트로 사용됩니다.
        </p>

        <section className="mt-10">
          <PdfUploader brands={brands} />
        </section>

        <section className="mt-14">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">최근 업로드</h2>
            <Link
              href="/admin/seed"
              className="text-xs text-muted-foreground hover:underline"
            >
              새로고침
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              아직 업로드된 PDF가 없습니다.
            </p>
          ) : (
            <ul className="divide-y rounded-md border bg-card text-sm">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="flex-1 truncate" title={r.fileName}>
                    {r.fileName}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {brandById.get(r.brandId)?.name ?? r.brandId.slice(0, 6)}
                  </span>
                  {r.pages ? (
                    <span className="text-xs text-muted-foreground">
                      {r.pages}p
                    </span>
                  ) : null}
                  <Link
                    href={`/admin/seed/${r.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    보기
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
