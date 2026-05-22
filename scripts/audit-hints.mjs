#!/usr/bin/env node
/**
 * 학습된 PDF 들의 structured.sentenceHints (Sonnet 자동 라벨)를 훑어서
 * NG/WARN 표현 후보를 모아 출력. 룰셋 보강 시 후보 채굴용.
 *
 * 사용:
 *   node scripts/audit-hints.mjs                 # 모든 PDF
 *   node scripts/audit-hints.mjs --brand 동아제약  # 브랜드 필터
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const REF_DIR = resolve('uploads/reference-sheets');
const ENDPOINT = process.env.BRIFBYAI_BASE ?? 'http://localhost:3000';
const brandFilter = process.argv.includes('--brand')
  ? process.argv[process.argv.indexOf('--brand') + 1]
  : null;

const brandsResp = await fetch(`${ENDPOINT}/api/brands`);
const { brands } = await brandsResp.json();
const brandById = new Map(brands.map((b) => [b.id, b]));

const files = (await readdir(REF_DIR))
  .filter((f) => f.endsWith('.json') && f !== 'index.json');

function findHints(obj) {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj.sentenceHints)) return obj.sentenceHints;
  for (const k of Object.keys(obj)) {
    const r = findHints(obj[k]);
    if (r.length) return r;
  }
  return [];
}

const bucket = { NG: [], WARN: [] };
let scanned = 0;

for (const f of files) {
  const payload = JSON.parse(await readFile(join(REF_DIR, f), 'utf8'));
  const brand = brandById.get(payload.brandId);
  if (brandFilter && brand?.name !== brandFilter) continue;
  scanned += 1;
  const hints = findHints(payload.structured);
  for (const h of hints) {
    const lvl = (h.label ?? h.level ?? h.hint ?? '').toUpperCase();
    if (lvl === 'NG' || lvl === 'WARN') {
      bucket[lvl].push({
        text: h.text ?? '',
        reason: h.reason ?? '',
        file: payload.fileName,
      });
    }
  }
}

console.log(`────── scanned ${scanned} PDFs ${brandFilter ? `(brand=${brandFilter})` : ''} ──────\n`);

for (const lvl of ['NG', 'WARN']) {
  console.log(`══════════ ${lvl} (${bucket[lvl].length}건) ══════════`);
  for (const h of bucket[lvl]) {
    console.log(`  ${h.text}`);
    console.log(`    ↳ ${h.reason}`);
  }
  console.log();
}
