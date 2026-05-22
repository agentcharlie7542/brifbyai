import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Construction } from 'lucide-react';
import { getBrand } from '@/lib/db/repositories/brands';

export const dynamic = 'force-dynamic';

export default async function NewSheetPage({
  params,
}: {
  params: { brandId: string };
}) {
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
          {brand.name} · Qoo10 URL 한 개로 시트 초안을 생성합니다.
        </p>

        <div className="mt-10 rounded-lg border border-dashed bg-muted/30 p-10 text-center">
          <Construction className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Phase 4 — 시트 생성 플로우</p>
          <p className="mt-2 text-xs text-muted-foreground">
            다음 작업 항목:
          </p>
          <ul className="mx-auto mt-2 max-w-md space-y-1 text-left text-xs text-muted-foreground">
            <li>· Qoo10 URL 입력 → /api/qoo10/import 호출</li>
            <li>· 상품 데이터 + 브랜드 컨텍스트 + 학습 PDF 임베딩으로 초안 생성</li>
            <li>· 약기법 인라인 검증 (SAFE/WARN/NG)</li>
            <li>· 시트 저장 → /brands/{brand.id}/sheets/[id]</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
