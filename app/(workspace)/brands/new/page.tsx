import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createBrand } from '@/lib/db/repositories/brands';

export const dynamic = 'force-dynamic';

async function createBrandAction(formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? '').trim();
  const nameJa = String(formData.get('nameJa') ?? '').trim();
  const defaultMarket = String(formData.get('defaultMarket') ?? 'jp');
  const defaultTone = String(formData.get('defaultTone') ?? '').trim();

  if (!name) {
    throw new Error('브랜드명은 필수입니다.');
  }

  const market =
    defaultMarket === 'jp' || defaultMarket === 'kr' || defaultMarket === 'global'
      ? defaultMarket
      : 'jp';

  const brand = await createBrand({
    name,
    nameJa: nameJa || null,
    defaultMarket: market,
    defaultTone: defaultTone || null,
  });

  revalidatePath('/brands');
  redirect(`/brands/${brand.id}`);
}

export default function NewBrandPage() {
  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/brands"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 브랜드 목록
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">새 브랜드</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          브랜드 단위로 학습 PDF, 제품, 생성 시트가 분리되어 관리됩니다.
        </p>

        <form action={createBrandAction} className="mt-8 space-y-5">
          <Field
            label="브랜드명 *"
            name="name"
            placeholder="예: 동아제약"
            required
          />
          <Field
            label="브랜드명 (일본어)"
            name="nameJa"
            placeholder="예: 東亜製薬"
          />

          <div>
            <label className="block text-sm font-medium">기본 마켓</label>
            <select
              name="defaultMarket"
              defaultValue="jp"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="jp">일본 (jp)</option>
              <option value="kr">한국 (kr)</option>
              <option value="global">글로벌</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">기본 톤 (선택)</label>
            <textarea
              name="defaultTone"
              rows={3}
              placeholder="예: 신뢰감 있고 차분한 의약 전문가 톤"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/brands"
              className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm shadow-sm hover:bg-accent"
            >
              취소
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              브랜드 만들기
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
