import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listBrands, createBrand } from '@/lib/db/repositories/brands';

export const runtime = 'nodejs';

export async function GET() {
  const brands = await listBrands();
  return NextResponse.json({ brands });
}

const CreateBody = z.object({
  name: z.string().min(1).max(128),
  nameJa: z.string().max(128).optional(),
  defaultMarket: z.enum(['jp', 'kr', 'global']).default('jp'),
  defaultTone: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  brandGuideUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const brand = await createBrand(parsed.data);
    return NextResponse.json({ brand }, { status: 201 });
  } catch (err) {
    console.error('[api/brands POST]', err);
    return NextResponse.json(
      { error: 'failed to create brand', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
