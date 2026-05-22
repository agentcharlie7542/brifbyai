import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Library, Settings, Sparkles, ArrowRight } from 'lucide-react';
import { getBrand } from '@/lib/db/repositories/brands';
import { listReferenceSheetsByBrand } from '@/lib/db/repositories/reference-sheets';
import { listSheetsByBrand } from '@/lib/db/repositories/sheets';

export const dynamic = 'force-dynamic';

export default async function BrandDashboardPage({
  params,
}: {
  params: { brandId: string };
}) {
  const brand = await getBrand(params.brandId);
  if (!brand) notFound();

  const [refs, sheets] = await Promise.all([
    listReferenceSheetsByBrand(brand.id),
    listSheetsByBrand(brand.id),
  ]);

  return (
    <main className="px-10 py-10">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {brand.nameJa ?? '—'} · 기본 마켓 {brand.defaultMarket.toUpperCase()}
          </p>
        </div>
        <Link
          href={`/brands/${brand.id}/new`}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />새 시트 만들기
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="생성된 시트"
          value={sheets.length}
          href={`/brands/${brand.id}/sheets`}
        />
        <Stat
          label="학습 PDF"
          value={refs.length}
          href={`/brands/${brand.id}/library`}
        />
        <Stat
          label="기본 마켓"
          value={brand.defaultMarket.toUpperCase()}
          href={`/brands/${brand.id}/settings`}
        />
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <ActionCard
          href={`/brands/${brand.id}/new`}
          icon={<Sparkles className="h-5 w-5" />}
          title="새 시트 만들기"
          body="Qoo10 URL 한 개로 약기법 검증된 오리엔트시트 초안을 생성합니다."
        />
        <ActionCard
          href={`/brands/${brand.id}/library`}
          icon={<Library className="h-5 w-5" />}
          title="학습 PDF 업로드"
          body="과거 오리엔트시트 PDF를 업로드해 톤·구조를 학습시킵니다."
        />
        <ActionCard
          href={`/brands/${brand.id}/sheets`}
          icon={<FileText className="h-5 w-5" />}
          title="기존 시트 보기"
          body="이전에 생성한 시트를 검토·재편집합니다."
        />
        <ActionCard
          href={`/brands/${brand.id}/settings`}
          icon={<Settings className="h-5 w-5" />}
          title="브랜드 설정"
          body="기본 마켓, 톤, 로고, 가이드 URL을 관리합니다."
        />
      </section>

      <section className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">최근 학습 PDF</h2>
          <Link
            href={`/brands/${brand.id}/library`}
            className="text-xs text-muted-foreground hover:underline"
          >
            전체 보기
          </Link>
        </div>
        {refs.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            아직 학습 PDF가 없습니다.
          </p>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {refs.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Link
                  href={`/brands/${brand.id}/library/${r.id}`}
                  className="flex-1 truncate hover:underline"
                >
                  {r.fileName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {r.pages ?? '?'}p
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.uploadedAt).toLocaleDateString('ko-KR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Link>
  );
}

function ActionCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
