import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getBrand } from '@/lib/db/repositories/brands';
import { getSheet } from '@/lib/db/repositories/sheets';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
import { SheetView } from './sheet-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function SheetDetailPage({
  params,
}: {
  params: { brandId: string; id: string };
}) {
  noStore();
  const [brand, sheet] = await Promise.all([
    getBrand(params.brandId),
    getSheet(params.id),
  ]);
  if (!brand || !sheet || sheet.brandId !== brand.id) notFound();

  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/brands/${brand.id}/sheets`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {brand.name} · 시트 목록
        </Link>
        <SheetView
          initial={{
            id: sheet.id,
            brandId: brand.id,
            brandName: brand.name,
            campaignName: sheet.campaignName,
            category: sheet.category,
            targetMarket: sheet.targetMarket,
            createdAt: sheet.createdAt.toISOString(),
            content: (sheet.content ?? {}) as StructuredOrientSheet,
            yakkihouSummary: sheet.yakkihouSummary,
          }}
        />
      </div>
    </main>
  );
}
