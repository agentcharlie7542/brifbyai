import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchWithCandidates } from '@/lib/db/repositories/trend-words';

export const runtime = 'nodejs';

const Body = z.object({
  q: z.string().min(1).max(64),
  category: z.string().max(64).optional(),
  includeAvoid: z.boolean().optional().default(true),
});

async function run(q: string, category?: string, includeAvoid = true) {
  const groups = await searchWithCandidates(q, { category, includeAvoid });
  const status = groups.length > 0 ? 'FOUND' : 'UNREGISTERED';
  return { status, groups };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim();
    if (!q) {
      return NextResponse.json({ error: 'missing q' }, { status: 400 });
    }
    const category = url.searchParams.get('category') ?? undefined;
    return NextResponse.json(await run(q, category));
  } catch (err) {
    console.error('[api/trend-words/search GET]', err);
    return NextResponse.json(
      { error: 'search failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { q, category, includeAvoid } = parsed.data;
    return NextResponse.json(await run(q, category, includeAvoid));
  } catch (err) {
    console.error('[api/trend-words/search POST]', err);
    return NextResponse.json(
      { error: 'search failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
