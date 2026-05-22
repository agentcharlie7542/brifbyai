import Link from 'next/link';
import { Plus, ArrowRight } from 'lucide-react';
import {
  listBrands,
} from '@/lib/db/repositories/brands';
import {
  listReferenceSheets,
} from '@/lib/db/repositories/reference-sheets';

export const dynamic = 'force-dynamic';

export default async function BrandsIndexPage() {
  const [brands, sheets] = await Promise.all([
    listBrands(),
    listReferenceSheets(),
  ]);

  const refCountByBrand = new Map<string, number>();
  for (const s of sheets) {
    refCountByBrand.set(s.brandId, (refCountByBrand.get(s.brandId) ?? 0) + 1);
  }

  return (
    <main className="px-10 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">브랜드</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            브랜드별로 오리엔트시트 학습 데이터와 생성 시트를 관리합니다.
          </p>
        </div>
        <Link
          href="/brands/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />새 브랜드
        </Link>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            아직 등록된 브랜드가 없습니다.
          </p>
          <Link
            href="/brands/new"
            className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            첫 브랜드 추가하기 <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={`/brands/${brand.id}`}
                className="block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-base font-semibold text-primary">
                    {brand.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold">{brand.name}</p>
                    {brand.nameJa ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {brand.nameJa}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <span>
                    학습 PDF{' '}
                    <span className="font-medium text-foreground">
                      {refCountByBrand.get(brand.id) ?? 0}
                    </span>
                  </span>
                  <span>
                    마켓{' '}
                    <span className="font-medium uppercase text-foreground">
                      {brand.defaultMarket}
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
