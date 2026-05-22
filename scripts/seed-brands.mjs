// Seed initial brands. Idempotent: skips brands that already exist by name.
// Run with: npm run db:seed   (loads .env.local via node --env-file)
import { neon } from '@neondatabase/serverless';

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

const SEED = [
  { name: '동아제약', name_ja: '東亜製薬', default_market: 'jp' },
  { name: '아이힐', name_ja: 'アイヒール', default_market: 'jp' },
];

for (const brand of SEED) {
  const existing = await sql`SELECT id FROM brands WHERE name = ${brand.name} LIMIT 1`;
  if (existing.length > 0) {
    console.log(`· skip (exists): ${brand.name}`);
    continue;
  }
  await sql`
    INSERT INTO brands (name, name_ja, default_market)
    VALUES (${brand.name}, ${brand.name_ja}, ${brand.default_market})
  `;
  console.log(`✓ created: ${brand.name}`);
}
console.log('done.');
