import { NextResponse } from 'next/server';
import { ensureSeedBrands } from '@/lib/storage/local';

export const runtime = 'nodejs';

export async function GET() {
  const brands = await ensureSeedBrands();
  return NextResponse.json({ brands });
}
