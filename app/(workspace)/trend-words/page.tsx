import Link from 'next/link';
import {
  listBrandConventions,
  listCategories,
} from '@/lib/db/repositories/trend-words';
import { TrendWordsClient } from './trend-words-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Trend KeyWord 매칭 — brifbyai',
};

export default async function TrendWordsPage() {
  const [conventions, categories] = await Promise.all([
    listBrandConventions(),
    listCategories(),
  ]);

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 홈
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Trend KeyWord 매칭
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          한국 트렌드 워드를 입력하면 일본 현지 매칭어 후보를 노출도·거부감·해시태그·
          약기법(薬機法) 리스크와 함께 비교합니다. 사전에 없는 단어는{' '}
          <span className="font-medium text-foreground">미등록</span>으로 표시되며
          Claude 가 번역 후보를 제안하고, 채택한 후보를 사전에 등록할 수 있습니다.
        </p>

        <div className="mt-8">
          <TrendWordsClient conventions={conventions} categories={categories} />
        </div>
      </div>
    </main>
  );
}
