import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { ReferenceSheet, NewReferenceSheet } from '@/db/schema';

export async function listReferenceSheets(): Promise<ReferenceSheet[]> {
  return db
    .select()
    .from(schema.referenceSheets)
    .orderBy(desc(schema.referenceSheets.uploadedAt));
}

export async function listReferenceSheetsByBrand(
  brandId: string
): Promise<ReferenceSheet[]> {
  return db
    .select()
    .from(schema.referenceSheets)
    .where(eq(schema.referenceSheets.brandId, brandId))
    .orderBy(desc(schema.referenceSheets.uploadedAt));
}

export async function getReferenceSheet(
  id: string
): Promise<ReferenceSheet | null> {
  const rows = await db
    .select()
    .from(schema.referenceSheets)
    .where(eq(schema.referenceSheets.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createReferenceSheet(
  input: NewReferenceSheet
): Promise<ReferenceSheet> {
  const [created] = await db
    .insert(schema.referenceSheets)
    .values(input)
    .returning();
  return created;
}

export async function deleteReferenceSheet(id: string): Promise<void> {
  await db
    .delete(schema.referenceSheets)
    .where(eq(schema.referenceSheets.id, id));
}
