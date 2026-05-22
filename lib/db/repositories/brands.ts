import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Brand, NewBrand } from '@/db/schema';

export async function listBrands(): Promise<Brand[]> {
  return db.select().from(schema.brands).orderBy(asc(schema.brands.name));
}

export async function getBrand(id: string): Promise<Brand | null> {
  const rows = await db
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBrand(input: NewBrand): Promise<Brand> {
  const [created] = await db.insert(schema.brands).values(input).returning();
  return created;
}

export async function updateBrand(
  id: string,
  patch: Partial<NewBrand>
): Promise<Brand | null> {
  const [updated] = await db
    .update(schema.brands)
    .set(patch)
    .where(eq(schema.brands.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteBrand(id: string): Promise<void> {
  await db.delete(schema.brands).where(eq(schema.brands.id, id));
}
