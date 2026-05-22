import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText } from 'lucide-react';
import { getBrand } from '@/lib/db/repositories/brands';
import { listReferenceSheetsByBrand } from '@/lib/db/repositories/reference-sheets';
import { PdfUploader } from '@/components/pdf-uploader';

export const dynamic = 'force-dynamic';

export default async function BrandLibraryPage({
  params,
}: {
  params: { brandId: string };
}) {
  const brand = await getBrand(params.brandId);
  if (!brand) notFound();
  const refs = await listReferenceSheetsByBrand(brand.id);

  return (
    <main className="px-10 py-10">
      <Link
        href={`/brands/${brand.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {brand.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">학습 PDF</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        과거 오리엔트시트를 업로드하면 Claude 가 구조화해 톤·구성 학습에 사용합니다.
      </p>

      <section className="mt-8">
        <PdfUploader brandId={brand.id} brandName={brand.name} />
      </section>

      <section className="mt-14">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">업로드 목록 · {refs.length}건</h2>
        </div>
        {refs.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            아직 업로드된 PDF가 없습니다.
          </div>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {refs.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Link
                  href={`/brands/${brand.id}/library/${r.id}`}
                  className="flex-1 truncate hover:underline"
                >
                  {r.fileName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {r.pages ?? '?'}p
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.uploadedAt).toLocaleDateString('ko-KR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
