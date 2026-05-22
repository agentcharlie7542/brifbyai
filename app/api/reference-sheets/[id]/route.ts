import { NextResponse } from 'next/server';
import {
  getReferenceSheet,
  deleteReferenceSheet,
} from '@/lib/db/repositories/reference-sheets';
import { deletePdf } from '@/lib/storage/blob';

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

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sheet = await getReferenceSheet(params.id);
    if (!sheet) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    await deleteReferenceSheet(params.id);
    if (sheet.storageUrl) {
      // Best-effort: log but don't fail the request if blob is already gone.
      await deletePdf(sheet.storageUrl).catch((err) =>
        console.error('[api/reference-sheets DELETE] blob delete failed', err)
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/reference-sheets DELETE]', err);
    return NextResponse.json(
      { error: 'failed to delete', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
