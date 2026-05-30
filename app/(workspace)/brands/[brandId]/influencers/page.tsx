import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getBrand } from '@/lib/db/repositories/brands';
import { listInfluencersByBrand } from '@/lib/db/repositories/influencers';
import { InfluencerManager } from './influencer-manager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function InfluencersPage({
  params,
}: {
  params: { brandId: string };
}) {
  noStore();
  const brand = await getBrand(params.brandId);
  if (!brand) notFound();
  const influencers = await listInfluencersByBrand(brand.id);

  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/brands/${brand.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {brand.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">인플루언서</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {brand.name} · 계정을 등록하면 최근 게시물을 분석해 맞춤 제안에 활용합니다.
        </p>

        <div className="mt-8">
          <InfluencerManager
            brandId={brand.id}
            initial={influencers.map((i) => ({
              id: i.id,
              platform: i.platform,
              handle: i.handle,
              displayName: i.displayName,
              followerCount: i.followerCount,
              url: i.url,
              hasPersona: Boolean(i.persona),
              postsCount: Array.isArray(
                (i.profile as { posts?: unknown[] } | null)?.posts
              )
                ? ((i.profile as { posts?: unknown[] }).posts?.length ?? 0)
                : 0,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
