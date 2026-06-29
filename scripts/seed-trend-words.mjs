// Seed 트렌드워드 매칭 (Language Packaging Engine) 초기 한일 매칭 사전.
// Idempotent: 이미 존재하는 행은 건너뜀.
// Run with: npm run db:seed-trends   (loads .env.local via node --env-file)
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const connectionString =
  process.env.POSTGRES_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  console.error(
    'POSTGRES_DATABASE_URL (or DATABASE_URL) is not set. Add it to .env.local.'
  );
  process.exit(1);
}

const sql = neon(connectionString);

// ── RFC4180-ish CSV 파서 (따옴표 안 쉼표·개행 처리, BOM 제거) ──
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // skip
    } else if (c === '\n') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

// ── 정규화 헬퍼 ──
const clean = (s) => (s ?? '').trim();
const dashToNull = (s) => {
  const v = clean(s);
  return v === '' || v === '-' ? null : v;
};
const toInt = (s) => {
  const v = clean(s).replace(/[^0-9]/g, '');
  return v === '' ? null : parseInt(v, 10);
};

function normScript(s) {
  switch (clean(s)) {
    case '한자':
      return 'KANJI';
    case '카타카나':
      return 'KATAKANA';
    case '히라가나':
      return 'HIRAGANA';
    case '혼합':
      return 'MIXED';
    case '영문':
      return 'ROMAN';
    default:
      return 'UNKNOWN';
  }
}
function normMatch(s) {
  const v = clean(s).toUpperCase();
  return ['A', 'B', 'C', 'D', 'X'].includes(v) ? v : null;
}
function normExposure(s) {
  switch (clean(s)) {
    case '高':
      return 'HIGH';
    case '中':
      return 'MID';
    case '低':
      return 'LOW';
    default:
      return null;
  }
}
function normAversion(s) {
  switch (clean(s)) {
    case '낮음':
      return 'LOW';
    case '중간':
      return 'MID';
    case '높음':
      return 'HIGH';
    default:
      return null;
  }
}
function normRisk(s) {
  const v = clean(s).toUpperCase();
  return ['SAFE', 'CAUTION', 'PROHIBITED'].includes(v) ? v : null;
}
function splitList(s) {
  const v = dashToNull(s);
  if (!v) return [];
  return v
    .split(/[,、]/)
    .map((x) => x.trim())
    .filter((x) => x && x !== '-');
}
function parseCategory(s) {
  const v = clean(s);
  const idx = v.indexOf('/');
  if (idx < 0) return [v || null, null];
  return [v.slice(0, idx).trim() || null, v.slice(idx + 1).trim() || null];
}

// ── CSV 로드 ──
const dictRecords = parseCsv(
  readFileSync(join(DATA_DIR, '한일_트렌드워드_매칭사전_v1.csv'), 'utf8')
);
const brandRecords = parseCsv(
  readFileSync(join(DATA_DIR, '브랜드_번역관례_v1.csv'), 'utf8')
);

// dict: records[0] 은 멀티라인 헤더(단일 레코드). 데이터 = 0번 칼럼이 숫자 ID 인 행.
const dictRows = dictRecords.filter((r) => /^\d+$/.test(clean(r[0])));
// brand: records[0] 은 헤더. 데이터 = 0번 칼럼(브랜드)이 비지 않고 '브랜드' 가 아닌 행.
const brandRows = brandRecords
  .slice(1)
  .filter((r) => clean(r[0]) !== '' && clean(r[0]) !== '브랜드');

console.log(`parsed: dict ${dictRows.length} rows, brand ${brandRows.length} rows`);

// dict 칼럼 위치: 0 ID · 1 카테고리 · 2 한국워드 · 3 직역 · 4 일본매칭어 · 5 읽기 ·
//   6 표기유형 · 7 매칭유형 · 8 우선순위 · 9 IG해시태그 · 10 검색노출도 · 11 거부감 ·
//   12 약기법리스크 · 13 약기법비고 · 14 브랜드채택 · 15 연관키워드 · 16 뉘앙스

// ── 1) kr_trend_terms (단어당 1행) ──
const krMap = new Map(); // krTerm -> id
const seenKr = new Map(); // krTerm -> [category, subCategory] (최초 등장 기준)
for (const r of dictRows) {
  const krTerm = clean(r[2]);
  if (!krTerm) continue;
  if (!seenKr.has(krTerm)) seenKr.set(krTerm, parseCategory(r[1]));
}
let krCreated = 0;
let krSkipped = 0;
for (const [krTerm, [category, subCategory]] of seenKr) {
  const existing =
    await sql`SELECT id FROM kr_trend_terms WHERE kr_term = ${krTerm} LIMIT 1`;
  if (existing.length > 0) {
    krMap.set(krTerm, existing[0].id);
    krSkipped++;
    continue;
  }
  const inserted = await sql`
    INSERT INTO kr_trend_terms (kr_term, category, sub_category, synonym_group)
    VALUES (${krTerm}, ${category}, ${subCategory}, ${krTerm})
    RETURNING id
  `;
  krMap.set(krTerm, inserted[0].id);
  krCreated++;
}
console.log(`kr_trend_terms: ✓ ${krCreated} created · ${krSkipped} skip`);

// ── 2) jp_matched_terms (CSV 1행 = 후보 1개) ──
let jpCreated = 0;
let jpSkipped = 0;
for (const r of dictRows) {
  const krTerm = clean(r[2]);
  const jpTerm = dashToNull(r[4]);
  if (!krTerm || !jpTerm) continue;
  const krTermId = krMap.get(krTerm);
  if (!krTermId) continue;
  const existing = await sql`
    SELECT id FROM jp_matched_terms
    WHERE kr_term_id = ${krTermId} AND jp_term = ${jpTerm} LIMIT 1`;
  if (existing.length > 0) {
    jpSkipped++;
    continue;
  }
  const brandAdoption = JSON.stringify(splitList(r[14]));
  const relatedKeywords = JSON.stringify(splitList(r[15]));
  await sql`
    INSERT INTO jp_matched_terms (
      kr_term_id, jp_term, jp_reading, literal_baseline, script_type, match_type,
      priority_rank, ig_hashtag_count, ig_count_status, exposure_level, aversion_level,
      yakkihou_risk, yakkihou_note, nuance_note, brand_adoption, related_keywords, source
    ) VALUES (
      ${krTermId}, ${jpTerm}, ${dashToNull(r[5])}, ${dashToNull(r[3])},
      ${normScript(r[6])}, ${normMatch(r[7])}, ${toInt(r[8]) ?? 9}, ${toInt(r[9])},
      'ESTIMATED', ${normExposure(r[10])}, ${normAversion(r[11])}, ${normRisk(r[12])},
      ${dashToNull(r[13])}, ${dashToNull(r[16])},
      ${brandAdoption}::jsonb, ${relatedKeywords}::jsonb, 'SEED'
    )`;
  jpCreated++;
}
console.log(`jp_matched_terms: ✓ ${jpCreated} created · ${jpSkipped} skip`);

// ── 3) brand_term_conventions ──
const OWNED_BRANDS = ['iHEAL', 'Mileat', 'GlowU'];
let bcCreated = 0;
let bcSkipped = 0;
for (const r of brandRows) {
  const brandRaw = clean(r[0]);
  if (!brandRaw) continue;
  const isOwned =
    brandRaw.includes('★자사') ||
    OWNED_BRANDS.some((b) => brandRaw.startsWith(b));
  const brand = brandRaw.replace('★자사', '').trim();
  const existing =
    await sql`SELECT id FROM brand_term_conventions WHERE brand = ${brand} LIMIT 1`;
  if (existing.length > 0) {
    bcSkipped++;
    continue;
  }
  const adoptedTerms = JSON.stringify(splitList(r[3]));
  await sql`
    INSERT INTO brand_term_conventions (
      brand, brand_type, category_hint, style_note, adopted_terms, avoid_terms
    ) VALUES (
      ${brand}, ${isOwned ? 'OWNED' : 'COMPETITOR'}, ${dashToNull(r[1])},
      ${dashToNull(r[2])}, ${adoptedTerms}::jsonb, ${dashToNull(r[4])}
    )`;
  bcCreated++;
}
console.log(`brand_term_conventions: ✓ ${bcCreated} created · ${bcSkipped} skip`);
console.log('done.');
