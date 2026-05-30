import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { User, NewUser } from '@/db/schema';

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listUsers(): Promise<User[]> {
  return db.select().from(schema.users).orderBy(asc(schema.users.email));
}

export async function createUser(input: NewUser): Promise<User> {
  const [created] = await db
    .insert(schema.users)
    .values({ ...input, email: input.email.toLowerCase().trim() })
    .returning();
  return created;
}

export async function updateUser(
  id: string,
  patch: Partial<NewUser>
): Promise<User | null> {
  const [updated] = await db
    .update(schema.users)
    .set(patch)
    .where(eq(schema.users.id, id))
    .returning();
  return updated ?? null;
}

export async function setLastLogin(id: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, id));
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: schema.users.id }).from(schema.users);
  return rows.length;
}
