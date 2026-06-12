import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { Sparkles } from 'lucide-react';
import { getBrand } from '@/lib/db/repositories/brands';
import { listSheetsByBrand } from '@/lib/db/repositories/sheets';
import { SheetRow } from './sheet-row';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function BrandSheetsPage({
  params,
}: {
  params: { brandId: string };
}) {
  noStore();
  const brand = await getBrand(params.brandId);
  if (!brand) notFound();
  const sheets = await listSheetsByBrand(brand.id);

  return (
    <main className="px-10 py-10">
      <Link
        href={`/brands/${brand.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {brand.name}
      </Link>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">오리엔트시트</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {brand.name} 브랜드로 생성된 모든 시트 · {sheets.length}건
          </p>
        </div>
        <Link
          href={`/brands/${brand.id}/new`}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />새 시트 만들기
        </Link>
      </div>

      <div className="mt-8">
        {sheets.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
            아직 생성된 시트가 없습니다.
            <br />
            <Link
              href={`/brands/${brand.id}/new`}
              className="mt-3 inline-block text-primary hover:underline"
            >
              첫 시트 만들기 →
            </Link>
          </div>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {sheets.map((s) => (
              <SheetRow
                key={s.id}
                brandId={brand.id}
                sheetId={s.id}
                campaignName={s.campaignName}
                category={s.category}
                targetMarket={s.targetMarket}
                yakkihouSummary={
                  s.yakkihouSummary
                    ? {
                        safe: s.yakkihouSummary.safe,
                        warn: s.yakkihouSummary.warn,
                        ng: s.yakkihouSummary.ng,
                      }
                    : null
                }
                updatedAt={s.updatedAt.toISOString()}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
