import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Product, NewProduct } from '@/db/schema';

export async function listProductsByBrand(brandId: string): Promise<Product[]> {
  return db
    .select()
    .from(schema.products)
    .where(eq(schema.products.brandId, brandId))
    .orderBy(asc(schema.products.name));
}

export async function getProduct(id: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createProduct(input: NewProduct): Promise<Product> {
  const [created] = await db.insert(schema.products).values(input).returning();
  return created;
}
