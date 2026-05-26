import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getBrand } from '@/lib/db/repositories/brands';
import { NewSheetForm } from './new-sheet-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function NewSheetPage({
  params,
}: {
  params: { brandId: string };
}) {
  noStore();
  const brand = await getBrand(params.brandId);
  if (!brand) notFound();

  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/brands/${brand.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {brand.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          새 오리엔트시트
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {brand.name} · Qoo10 URL 한 개로 상품 정보를 가져와 시트 초안을 만듭니다.
        </p>

        <div className="mt-8">
          <NewSheetForm brandId={brand.id} brandName={brand.name} />
        </div>
      </div>
    </main>
  );
}
