import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSeedBrands, getReferenceSheet } from '@/lib/storage/local';
import { YakkihouValidator } from '@/components/yakkihou-validator';

export const dynamic = 'force-dynamic';

// 브랜드명 → 약기법 카테고리 휴리스틱. 향후 product.category 로 대체.
function inferCategory(brandName?: string): string {
  if (!brandName) return 'health_food';
  if (brandName.includes('아이힐') || brandName.includes('iHEAL')) return 'health_food';
  if (brandName.includes('동아') || brandName.includes('東亜')) return 'health_food';
  return 'health_food';
}

export default async function ReferenceSheetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sheet = await getReferenceSheet(params.id);
  if (!sheet) notFound();

  const brands = await ensureSeedBrands();
  const brand = brands.find((b) => b.id === sheet.brandId);

  return (
    <main className="container py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/seed"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 학습 데이터 목록
        </Link>
        <h1 className="mt-2 break-all text-2xl font-bold tracking-tight">
          {sheet.fileName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {brand?.name ?? sheet.brandId} · {sheet.pages ?? '?'}p ·{' '}
          {new Date(sheet.uploadedAt).toLocaleString('ko-KR')}
        </p>

        <section className="mt-10">
          <h2 className="mb-2 text-base font-semibold">
            약기법 인라인 검증 (원본 텍스트에 대해)
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            아래는 추출된 원본 텍스트입니다. 자동 검증 결과가 하이라이팅되며,
            NG/WARN 부분 클릭으로 권장 표현 교체 가능합니다. 편집 결과는
            저장되지 않습니다 (시드 원본 보존).
          </p>
          <YakkihouValidator
            initialText={sheet.parsedText || ''}
            initialCategory={inferCategory(brand?.name)}
          />
        </section>

        <section className="mt-12">
          <h2 className="mb-2 text-base font-semibold">구조화 결과 (Claude)</h2>
          <pre className="max-h-[480px] overflow-auto rounded-md border bg-muted/40 p-4 text-xs">
            {JSON.stringify(sheet.structured, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
