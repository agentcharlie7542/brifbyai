import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Sparkles } from 'lucide-react';
import { getBrand } from '@/lib/db/repositories/brands';
import { listSheetsByBrand } from '@/lib/db/repositories/sheets';

export const dynamic = 'force-dynamic';

export default async function BrandSheetsPage({
  params,
}: {
  params: { brandId: string };
}) {
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
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{s.campaignName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.category} · {s.targetMarket.toUpperCase()}
                  </p>
                </div>
                {s.yakkihouSummary ? (
                  <div className="flex gap-2 text-xs">
                    <span className="text-yakkihou-safe">
                      SAFE {s.yakkihouSummary.safe}
                    </span>
                    <span className="text-yakkihou-warn">
                      WARN {s.yakkihouSummary.warn}
                    </span>
                    <span className="text-yakkihou-ng">
                      NG {s.yakkihouSummary.ng}
                    </span>
                  </div>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {new Date(s.updatedAt).toLocaleDateString('ko-KR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
