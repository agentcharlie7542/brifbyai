#!/usr/bin/env node
/**
 * 약기법 validator 골든 케이스 검증.
 *
 * iHEAL PR참고자료 PDF 에서 추출된 실제 문장들에 대해
 * Phase 1 에서 Sonnet 이 라벨링했던 결과(ground truth)와
 * 우리 3-layer validator 의 출력을 비교한다.
 *
 * 두 모드:
 *   - rules     : Layer 1+2 만 (skipLayer3=true). 빠르고 무료. 룰셋 커버리지 측정용.
 *   - full      : Layer 3 까지. 골든 라벨과 가장 가까운 결과 기대.
 *
 * 사용:
 *   node scripts/golden-yakkihou.mjs            # rules only
 *   node scripts/golden-yakkihou.mjs --full     # +Claude
 */

const ENDPOINT = process.env.BRIFBYAI_BASE ?? 'http://localhost:3000';
const FULL = process.argv.includes('--full');

/** Phase 1 Sonnet ground truth (iHEAL ヴィーナス乳酸菌 PDF) */
const GOLDEN = [
  {
    text: '韓国特許取得乳酸菌が、膣内＋腸内環境を整えます',
    expected: 'SAFE',
    note: '성분 진술',
  },
  {
    text: 'デリケートゾーンのにおいやオリモノの原因となる、悪玉菌を抑えて善玉菌を増やします',
    expected: 'WARN',
    note: '균총 변화 단언',
  },
  {
    text: 'デリケートゾーンのかゆみ・においを抑える',
    expected: 'WARN',
    note: '신체 증상 억제',
  },
  {
    text: 'PCOS・生理痛・生理不順改善・PMS軽減サポート',
    expected: 'NG',
    note: '질환명 + 改善/軽減',
  },
  {
    text: 'ホルモンバランスを整えて生理前のニキビ悩みに効果あり',
    expected: 'NG',
    note: '効果あり 단정',
  },
  {
    text: '生きた乳酸菌が腸内環境を整えて普段の体質・体型管理にも◎',
    expected: 'WARN',
    note: '체질·체형 단언',
  },
  {
    text: '妊婦の方でも安全に服用でき、妊婦に必要な鉄分やビタミンを補うことができます。',
    expected: 'WARN',
    note: '안전성 단언',
  },
  {
    text: '女性に嬉しい鉄分・クランベリーも入っていて膣ケアから肌管理まで◎',
    expected: 'SAFE',
    note: '성분 + 일반 표현',
  },
  {
    text: '1日1粒摂取で続けやすい（朝推奨）',
    expected: 'SAFE',
    note: '사용법',
  },
];

const combined = GOLDEN.map((g) => g.text).join('\n');

const body = {
  text: combined,
  category: 'health_food',
  skipLayer3: !FULL,
};

console.log(`▶ POST ${ENDPOINT}/api/yakkihou/validate`);
console.log(`▶ mode: ${FULL ? 'full (Layer 1+2+3)' : 'rules only (Layer 1+2)'}`);
console.log('');

const t0 = Date.now();
const res = await fetch(`${ENDPOINT}/api/yakkihou/validate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const j = await res.json();
const dt = ((Date.now() - t0) / 1000).toFixed(1);

if (!res.ok) {
  console.error(`HTTP ${res.status}:`, j);
  process.exit(1);
}

console.log(`▶ summary: ${dt}s · seg=${j.segments.length} findings=${j.findings.length}`);
console.log(`▶ layer counts:`, j.layerCounts);
console.log('');

let pass = 0;
let fail = 0;
const rows = [];

for (const g of GOLDEN) {
  // 골든 문장과 startIndex 일치 여부로 결과 매칭
  const hits = j.findings.filter((f) => g.text.includes(f.text));
  let actual = 'SAFE';
  if (hits.some((h) => h.level === 'NG')) actual = 'NG';
  else if (hits.some((h) => h.level === 'WARN')) actual = 'WARN';

  const ok = actual === g.expected;
  const sigil = ok ? '✅' : '❌';
  if (ok) pass += 1;
  else fail += 1;

  const ruleIds = hits.map((h) => `L${h.layer}:${h.rule}`).join(', ');
  rows.push({
    sigil,
    expected: g.expected,
    actual,
    rules: ruleIds || '-',
    note: g.note,
    text: g.text.slice(0, 50),
  });
}

// 표 출력
const maxText = Math.max(...rows.map((r) => r.text.length));
console.log(
  '결과   기대  실제   매칭 룰                             메모              문장',
);
console.log('─'.repeat(120));
for (const r of rows) {
  console.log(
    `${r.sigil}     ${r.expected.padEnd(4)} ${r.actual.padEnd(5)}  ${r.rules.padEnd(36)} ${r.note.padEnd(16)} ${r.text}`,
  );
}
console.log('─'.repeat(120));
console.log(`\n총 ${pass + fail}건: ✅ ${pass} / ❌ ${fail}`);
console.log(`정확도: ${((pass / (pass + fail)) * 100).toFixed(1)}%`);

process.exit(fail > 0 ? 1 : 0);
