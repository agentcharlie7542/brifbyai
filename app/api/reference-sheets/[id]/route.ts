import { NextResponse } from 'next/server';
import { getReferenceSheet } from '@/lib/storage/local';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sheet = await getReferenceSheet(params.id);
  if (!sheet) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ sheet });
}
