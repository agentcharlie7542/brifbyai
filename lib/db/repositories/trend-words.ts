import { eq, asc, ilike, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import type {
  KrTrendTerm,
  JpMatchedTerm,
  BrandTermConvention,
  NewJpMatchedTerm,
} from '@/db/schema';

export interface CandidateGroup {
  krTermId: string;
  krTerm: string;
  category: string | null;
  subCategory: string | null;
  candidates: JpMatchedTerm[];
}

/**
 * 한국어 트렌드 워드 검색 → 일본어 후보를 우선순위(asc)로 그룹핑.
 * 결과 0건이면 빈 배열 → 호출부가 "미등록" 으로 처리.
 */
export async function searchWithCandidates(
  query: string,
  opts?: { category?: string; includeAvoid?: boolean }
): Promise<CandidateGroup[]> {
  const terms = await db
    .select()
    .from(schema.krTrendTerms)
    .where(ilike(schema.krTrendTerms.krTerm, `%${query}%`))
    .orderBy(asc(schema.krTrendTerms.krTerm));

  const filtered = opts?.category
    ? terms.filter((t) => t.category === opts.category)
    : terms;
  if (filtered.length === 0) return [];

  const candidates = await db
    .select()
    .from(schema.jpMatchedTerms)
    .where(
      inArray(
        schema.jpMatchedTerms.krTermId,
        filtered.map((t) => t.id)
      )
    )
    .orderBy(asc(schema.jpMatchedTerms.priorityRank));

  const byKr = new Map<string, JpMatchedTerm[]>();
  for (const c of candidates) {
    if (opts?.includeAvoid === false && c.matchType === 'X') continue;
    const arr = byKr.get(c.krTermId) ?? [];
    arr.push(c);
    byKr.set(c.krTermId, arr);
  }

  return filtered.map((t) => ({
    krTermId: t.id,
    krTerm: t.krTerm,
    category: t.category,
    subCategory: t.subCategory,
    candidates: byKr.get(t.id) ?? [],
  }));
}

/** 필터 칩용 대분류 목록 */
export async function listCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: schema.krTrendTerms.category })
    .from(schema.krTrendTerms)
    .orderBy(asc(schema.krTrendTerms.category));
  return rows.map((r) => r.category).filter((c): c is string => !!c);
}

/** 브랜드 번역 관례 전체 (OWNED 우선) — 오버레이 매칭에 사용 */
export async function listBrandConventions(): Promise<BrandTermConvention[]> {
  return db
    .select()
    .from(schema.brandTermConventions)
    .orderBy(
      asc(schema.brandTermConventions.brandType),
      asc(schema.brandTermConventions.brand)
    );
}

/** 한국어 트렌드 워드 upsert (등록 시 신규 단어 생성) */
export async function upsertKrTerm(input: {
  krTerm: string;
  category?: string | null;
  subCategory?: string | null;
}): Promise<KrTrendTerm> {
  const existing = await db
    .select()
    .from(schema.krTrendTerms)
    .where(eq(schema.krTrendTerms.krTerm, input.krTerm))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(schema.krTrendTerms)
    .values({
      krTerm: input.krTerm,
      category: input.category ?? null,
      subCategory: input.subCategory ?? null,
      synonymGroup: input.krTerm,
    })
    .returning();
  return created;
}

/** 일본어 후보 추가 (사용자 등록 / LLM 채택) */
export async function addJpCandidate(
  input: NewJpMatchedTerm
): Promise<JpMatchedTerm> {
  const [created] = await db
    .insert(schema.jpMatchedTerms)
    .values(input)
    .returning();
  return created;
}
