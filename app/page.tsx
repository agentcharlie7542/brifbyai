import Link from 'next/link';
import { FileText, Sparkles, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="container py-16">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          brifbyai · v0.1
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          오리엔트시트, <span className="text-yakkihou-safe">5분</span>이면
          충분합니다
        </h1>
        <p className="mt-5 text-pretty text-lg text-muted-foreground">
          Qoo10 상품 링크 한 개로 약기법(薬機法) 검증까지 끝난 멀티 브랜드
          오리엔트시트 초안을 자동 생성합니다.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/new"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Sparkles className="mr-2 h-4 w-4" />새 시트 만들기
          </Link>
          <Link
            href="/admin/seed"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <FileText className="mr-2 h-4 w-4" />
            PDF 학습 데이터 업로드
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-5xl gap-6 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-5 w-5 text-yakkihou-safe" />}
          title="Qoo10 자동 파싱"
          body="상품 URL을 붙여 넣으면 상품명·가격·카테고리·이미지를 3-tier 폴백으로 안전하게 가져옵니다."
        />
        <FeatureCard
          icon={<FileText className="h-5 w-5 text-primary" />}
          title="PDF 30+개 학습"
          body="과거 오리엔트시트를 PDF로 업로드하면 Claude가 구조화·임베딩하여 톤·구조를 일관 유지합니다."
        />
        <FeatureCard
          icon={<ShieldCheck className="h-5 w-5 text-yakkihou-warn" />}
          title="약기법 인라인 검증"
          body="모든 문장을 SAFE/WARN/NG 3단계로 라벨링하고, NG는 대체 표현으로 원클릭 교체합니다."
        />
      </section>

      <footer className="mt-24 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} brifbyai · Aiden Lab Influencer Team
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
