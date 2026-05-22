// Seed initial brands. Idempotent: skips brands that already exist by name.
// Run with: npm run db:seed   (loads .env.local via node --env-file)
import { sql } from '@vercel/postgres';

const SEED = [
  { name: '동아제약', name_ja: '東亜製薬', default_market: 'jp' },
  { name: '아이힐', name_ja: 'アイヒール', default_market: 'jp' },
];

async function main() {
  for (const brand of SEED) {
    const existing = await sql`SELECT id FROM brands WHERE name = ${brand.name} LIMIT 1`;
    if (existing.rowCount && existing.rowCount > 0) {
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
