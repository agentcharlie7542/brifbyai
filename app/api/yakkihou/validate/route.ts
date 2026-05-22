import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validate } from '@/lib/yakkihou/validator';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PRODUCT_CATEGORIES = [
  'cosmetic',
  'quasi_drug',
  'health_food',
  'functional_food',
  'general_food',
  'medical_device',
  'general',
] as const;

const Body = z.object({
  text: z.string().min(1).max(50_000),
  category: z.enum(PRODUCT_CATEGORIES),
  skipLayer3: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await validate({
      text: parsed.data.text,
      category: parsed.data.category,
      apiKey: process.env.CLAUDE_ADMIN_KEY,
      skipLayer3: parsed.data.skipLayer3,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/yakkihou/validate]', err);
    return NextResponse.json(
      { error: 'validation failed', detail: message },
      { status: 500 }
    );
  }
}
