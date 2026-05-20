import { NextResponse } from 'next/server';
import { listReferenceSheets } from '@/lib/storage/local';

export const runtime = 'nodejs';

export async function GET() {
  const sheets = await listReferenceSheets();
  return NextResponse.json({ sheets });
}
