export default function AdminSeedPage() {
  return (
    <main className="container py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">
          PDF 학습 데이터 업로드
        </h1>
        <p className="mt-3 text-muted-foreground">
          브랜드를 선택하고 과거 오리엔트시트 PDF를 일괄 업로드하세요. (Phase 1)
        </p>
        <div className="mt-8 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          🚧 PDF drag-and-drop 업로더는 Phase 1에서 구현됩니다.
        </div>
      </div>
    </main>
  );
}
