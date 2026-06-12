import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Sheet, NewSheet } from '@/db/schema';

export async function listSheetsByBrand(brandId: string): Promise<Sheet[]> {
  return db
    .select()
    .from(schema.sheets)
    .where(eq(schema.sheets.brandId, brandId))
    .orderBy(desc(schema.sheets.updatedAt));
}

export async function getSheet(id: string): Promise<Sheet | null> {
  const rows = await db
    .select()
    .from(schema.sheets)
    .where(eq(schema.sheets.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSheet(input: NewSheet): Promise<Sheet> {
  const [created] = await db.insert(schema.sheets).values(input).returning();
  return created;
}

export async function updateSheet(
  id: string,
  patch: Partial<NewSheet>
): Promise<Sheet | null> {
  const [updated] = await db
    .update(schema.sheets)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.sheets.id, id))
    .returning();
  return updated ?? null;
}

/**
 * 시트 삭제. yakkihou_findings·influencer_proposals 는 schema 의 FK
 * `onDelete: 'cascade'` 로 자동 정리된다. 삭제된 row 의 brandId 를 반환
 * (audit log 에 entityType/entityId 로 남기기 위함).
 */
export async function deleteSheet(
  id: string
): Promise<{ id: string; brandId: string } | null> {
  const [deleted] = await db
    .delete(schema.sheets)
    .where(eq(schema.sheets.id, id))
    .returning({ id: schema.sheets.id, brandId: schema.sheets.brandId });
  return deleted ?? null;
}
