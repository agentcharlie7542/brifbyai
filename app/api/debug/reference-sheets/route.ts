import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId');

  const all = await db
    .select({
      id: schema.referenceSheets.id,
      brandId: schema.referenceSheets.brandId,
      fileName: schema.referenceSheets.fileName,
      uploadedAt: schema.referenceSheets.uploadedAt,
    })
    .from(schema.referenceSheets)
    .orderBy(desc(schema.referenceSheets.uploadedAt));

  const filtered = brandId
    ? await db
        .select({
          id: schema.referenceSheets.id,
          brandId: schema.referenceSheets.brandId,
          fileName: schema.referenceSheets.fileName,
          uploadedAt: schema.referenceSheets.uploadedAt,
        })
        .from(schema.referenceSheets)
        .where(eq(schema.referenceSheets.brandId, brandId))
        .orderBy(desc(schema.referenceSheets.uploadedAt))
    : null;

  const connectionEnv = {
    POSTGRES_DATABASE_URL: maskUrl(process.env.POSTGRES_DATABASE_URL),
    DATABASE_URL: maskUrl(process.env.DATABASE_URL),
    POSTGRES_URL: maskUrl(process.env.POSTGRES_URL),
  };

  return NextResponse.json({
    queryArg: brandId,
    totalCount: all.length,
    filteredCount: filtered?.length ?? null,
    allRows: all,
    filteredRows: filtered,
    connectionEnv,
  });
}

function maskUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '***@' : ''}${u.hostname}${u.pathname}`;
  } catch {
    return 'invalid url';
  }
}
