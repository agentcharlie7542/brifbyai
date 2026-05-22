import { drizzle } from 'drizzle-orm/neon-http';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

function getConnectionString(): string {
  const url =
    process.env.POSTGRES_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      'Postgres connection string is not set. Define POSTGRES_DATABASE_URL (or DATABASE_URL) in the environment.'
    );
  }
  return url;
}

function getDb() {
  if (_db) return _db;
  const sql: NeonQueryFunction<false, false> = neon(getConnectionString());
  _db = drizzle(sql, { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
