import { NextResponse } from 'next/server';
import { z } from 'zod';
import { suggestCandidates } from '@/lib/trend-words/suggest';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  q: z.string().min(1).max(64),
  category: z.string().max(64).optional(),
});

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
    const apiKey = process.env.CLAUDE_ADMIN_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CLAUDE_ADMIN_KEY not configured' },
        { status: 500 }
      );
    }
    const result = await suggestCandidates(parsed.data.q, apiKey, {
      category: parsed.data.category,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/trend-words/suggest]', err);
    return NextResponse.json(
      { error: 'suggest failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
