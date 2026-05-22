import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  getBrand,
  updateBrand,
  deleteBrand,
} from '@/lib/db/repositories/brands';

export const dynamic = 'force-dynamic';

async function saveAction(brandId: string, formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? '').trim();
  const nameJa = String(formData.get('nameJa') ?? '').trim();
  const defaultMarket = String(formData.get('defaultMarket') ?? 'jp');
  const defaultTone = String(formData.get('defaultTone') ?? '').trim();

  if (!name) throw new Error('브랜드명은 필수입니다.');
  const market =
    defaultMarket === 'jp' || defaultMarket === 'kr' || defaultMarket === 'global'
      ? defaultMarket
      : 'jp';

  await updateBrand(brandId, {
    name,
    nameJa: nameJa || null,
    defaultMarket: market,
    defaultTone: defaultTone || null,
  });

  revalidatePath('/brands');
  revalidatePath(`/brands/${brandId}`);
  revalidatePath(`/brands/${brandId}/settings`);
}

async function deleteAction(brandId: string) {
  'use server';
  await deleteBrand(brandId);
  revalidatePath('/brands');
  redirect('/brands');
}

export default async function BrandSettingsPage({
  params,
}: {
  params: { brandId: string };
}) {
  const brand = await getBrand(params.brandId);
  if (!brand) notFound();

  const save = saveAction.bind(null, brand.id);
  const remove = deleteAction.bind(null, brand.id);

  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href={`/brands/${brand.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {brand.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">브랜드 설정</h1>

        <form action={save} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium">브랜드명 *</label>
            <input
              type="text"
              name="name"
              defaultValue={brand.name}
              required
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">브랜드명 (일본어)</label>
            <input
              type="text"
              name="nameJa"
              defaultValue={brand.nameJa ?? ''}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">기본 마켓</label>
            <select
              name="defaultMarket"
              defaultValue={brand.defaultMarket}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="jp">일본 (jp)</option>
              <option value="kr">한국 (kr)</option>
              <option value="global">글로벌</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">기본 톤</label>
            <textarea
              name="defaultTone"
              rows={4}
              defaultValue={brand.defaultTone ?? ''}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              저장
            </button>
          </div>
        </form>

        <hr className="my-10" />

        <section>
          <h2 className="text-base font-semibold text-yakkihou-ng">
            위험 작업
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            브랜드 삭제 시 학습 PDF, 시트, 약기법 검증 결과가 모두 함께
            삭제됩니다. (취소 불가)
          </p>
          <form action={remove} className="mt-3">
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md border border-yakkihou-ng/40 px-3 text-xs text-yakkihou-ng hover:bg-yakkihou-ng/10"
            >
              브랜드 영구 삭제
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
