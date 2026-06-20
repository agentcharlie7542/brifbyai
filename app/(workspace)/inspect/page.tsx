import Link from 'next/link';
import { InspectClient } from './inspect-client';

export const metadata = {
  title: '상세페이지 검수 — brifbyai',
};

export default function InspectPage() {
  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/brands" className="text-sm text-muted-foreground hover:underline">
          ← 워크스페이스
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">상세페이지 검수</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          큐텐 상품 링크를 넣으면 상세페이지 <b>이미지를 캡쳐</b>해 텍스트를 OCR 로 읽고,
          상품 종류 기준으로 약기법(薬機法) 위반 문구를 <b>이미지 위에 체크 표기</b>한 뒤
          권장 대체표현과 전체 수정본까지 정리합니다. 이미지를 직접 업로드해도 됩니다.
        </p>

        <div className="mt-8">
          <InspectClient />
        </div>
      </div>
    </main>
  );
}
