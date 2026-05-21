#!/usr/bin/env node
/**
 * 폴더의 모든 PDF 를 /api/pdf/import 로 순차 업로드.
 *
 * 사용:
 *   node scripts/bulk-import.mjs <폴더>:<브랜드명> [<폴더>:<브랜드명> ...]
 *
 * 예:
 *   node scripts/bulk-import.mjs "../iheal:아이힐" "../동아제약:동아제약"
 *
 * - 폴더의 *.pdf 만 대상 (대소문자 무시)
 * - 이미 같은 fileName 으로 등록된 PDF 는 건너뜀
 * - 한 번에 1건씩 (Claude rate limit 고려, 안정성 우선)
 * - 실패해도 다음 파일로 진행, 마지막에 요약
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';

const ENDPOINT = process.env.BRIFBYAI_BASE ?? 'http://localhost:3000';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/bulk-import.mjs <dir>:<brand> [<dir>:<brand> ...]');
  process.exit(2);
}

const args = process.argv.slice(2).map((arg) => {
  const idx = arg.lastIndexOf(':');
  if (idx < 0) throw new Error(`잘못된 인자: ${arg} (형식: <폴더>:<브랜드명>)`);
  return { dir: resolve(arg.slice(0, idx)), brandName: arg.slice(idx + 1) };
});

async function fetchJson(path, init) {
  const res = await fetch(`${ENDPOINT}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  if (!res.ok) {
    const detail = json?.detail ?? json?.error ?? text;
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return json;
}

const { brands } = await fetchJson('/api/brands');
const { sheets: existing } = await fetchJson('/api/reference-sheets');
const existingByBrandAndName = new Set(
  existing.map((s) => `${s.brandId}::${s.fileName}`)
);

const brandByName = new Map(brands.map((b) => [b.name, b]));

let totalSucceeded = 0;
let totalSkipped = 0;
let totalFailed = 0;
const failures = [];

for (const { dir, brandName } of args) {
  const brand = brandByName.get(brandName);
  if (!brand) {
    console.error(
      `[skip dir] 브랜드 "${brandName}" 없음. 사용 가능: ${[...brandByName.keys()].join(', ')}`
    );
    continue;
  }

  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    console.error(`[skip dir] ${dir}: ${err.message}`);
    continue;
  }
  const pdfs = entries.filter((f) => f.toLowerCase().endsWith('.pdf')).sort();

  console.log(`\n── ${brandName} (${pdfs.length}개) — ${dir}`);

  for (let i = 0; i < pdfs.length; i += 1) {
    const fileName = pdfs[i];
    const filePath = join(dir, fileName);
    const tag = `[${i + 1}/${pdfs.length}] ${fileName}`;

    if (existingByBrandAndName.has(`${brand.id}::${fileName}`)) {
      console.log(`  ⏭  ${tag} (이미 등록됨)`);
      totalSkipped += 1;
      continue;
    }

    const st = await stat(filePath);
    process.stdout.write(`  ⬆  ${tag} (${(st.size / 1024).toFixed(0)} KB) ... `);
    const t0 = Date.now();

    try {
      const fd = new FormData();
      fd.append('brandId', brand.id);
      const buf = await readFile(filePath);
      fd.append(
        'file',
        new Blob([buf], { type: 'application/pdf' }),
        fileName
      );

      const res = await fetch(`${ENDPOINT}/api/pdf/import`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail ?? json?.error ?? `HTTP ${res.status}`);
      }
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✅  ${json.pages}p · ${dt}s · ${json.id.slice(0, 8)}`);
      existingByBrandAndName.add(`${brand.id}::${fileName}`);
      totalSucceeded += 1;
      // 요청 간 휴식 (rate limit & 커넥션 풀 부담 완화)
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`❌  ${dt}s · ${err.message.slice(0, 120)}`);
      failures.push({ file: fileName, brand: brandName, error: err.message });
      totalFailed += 1;
    }
  }
}

console.log('\n────── 결과 요약 ──────');
console.log(`✅  성공: ${totalSucceeded}`);
console.log(`⏭  건너뜀: ${totalSkipped}`);
console.log(`❌  실패: ${totalFailed}`);
if (failures.length > 0) {
  console.log('\n실패 목록:');
  for (const f of failures) {
    console.log(`  · [${f.brand}] ${f.file}`);
    console.log(`    ${f.error.slice(0, 200)}`);
  }
}
process.exit(totalFailed > 0 ? 1 : 0);
