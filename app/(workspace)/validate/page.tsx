import Link from 'next/link';
import { YakkihouValidator } from '@/components/yakkihou-validator';

export const metadata = {
  title: '약기법 검증 — brifbyai',
};

const SAMPLE = `「食べる日焼け止め」と言われる通常のトマトの5倍の効果があるホワイトトマト成分をたっぷり配合
グルタチオン配合で内側から透明感を上げることができ、抗酸化&メラニン合成の抑制&肌のトーンケアができる
1日1粒摂取で続けやすい（朝推奨）
飲み始めてから、白くなった気がする、日焼けにくくなった、透明感が上がった
体脂肪減少・血糖管理・ダイエットが可能なサプリメント`;

export default function ValidatePage() {
  return (
    <main className="container py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 홈
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">약기법 검증 플레이그라운드</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          일본어 광고·홍보 문구를 입력하면 600ms 후 자동으로 SAFE / WARN / NG
          라벨링됩니다. 빨간 NG 하이라이트를 클릭하면 권장 대체 표현으로
          바로 교체할 수 있습니다.
        </p>

        <div className="mt-8">
          <YakkihouValidator initialText={SAMPLE} initialCategory="health_food" />
        </div>
      </div>
    </main>
  );
}
