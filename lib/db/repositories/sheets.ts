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
