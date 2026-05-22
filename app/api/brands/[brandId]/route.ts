import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBrand,
  updateBrand,
  deleteBrand,
} from '@/lib/db/repositories/brands';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { brandId: string } }
) {
  const brand = await getBrand(params.brandId);
  if (!brand) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ brand });
}

const PatchBody = z.object({
  name: z.string().min(1).max(128).optional(),
  nameJa: z.string().max(128).nullable().optional(),
  defaultMarket: z.enum(['jp', 'kr', 'global']).optional(),
  defaultTone: z.string().max(2000).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandGuideUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { brandId: string } }
) {
  try {
    const body = await req.json();
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const brand = await updateBrand(params.brandId, parsed.data);
    if (!brand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ brand });
  } catch (err) {
    console.error('[api/brands PATCH]', err);
    return NextResponse.json(
      { error: 'failed to update brand', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { brandId: string } }
) {
  try {
    await deleteBrand(params.brandId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/brands DELETE]', err);
    return NextResponse.json(
      { error: 'failed to delete brand', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
