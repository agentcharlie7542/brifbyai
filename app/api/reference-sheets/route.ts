import { NextResponse } from 'next/server';
import {
  listReferenceSheets,
  listReferenceSheetsByBrand,
} from '@/lib/db/repositories/reference-sheets';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId');
  const sheets = brandId
    ? await listReferenceSheetsByBrand(brandId)
    : await listReferenceSheets();
  return NextResponse.json({ sheets });
}
