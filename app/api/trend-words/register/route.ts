import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  upsertKrTerm,
  addJpCandidate,
} from '@/lib/db/repositories/trend-words';

export const runtime = 'nodejs';

const Candidate = z.object({
  jpTerm: z.string().min(1).max(128),
  jpReading: z.string().max(128).optional(),
  scriptType: z
    .enum(['KANJI', 'KATAKANA', 'HIRAGANA', 'MIXED', 'ROMAN', 'UNKNOWN'])
    .optional(),
  matchType: z.enum(['A', 'B', 'C', 'D', 'X']).optional(),
  priorityRank: z.number().int().min(1).max(99),
  igHashtagCount: z.number().int().min(0).optional(),
  exposureLevel: z.enum(['HIGH', 'MID', 'LOW']).optional(),
  aversionLevel: z.enum(['LOW', 'MID', 'HIGH']).optional(),
  yakkihouRisk: z.enum(['SAFE', 'CAUTION', 'PROHIBITED']).optional(),
  yakkihouNote: z.string().max(2000).optional(),
  nuanceNote: z.string().max(2000).optional(),
  relatedKeywords: z.array(z.string()).max(20).optional(),
  brandAdoption: z.array(z.string()).max(20).optional(),
});

const Body = z.object({
  krTerm: z.string().min(1).max(128),
  category: z.string().max(64).optional(),
  subCategory: z.string().max(64).optional(),
  candidates: z.array(Candidate).min(1).max(10),
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
    const { krTerm, category, subCategory, candidates } = parsed.data;
    const kr = await upsertKrTerm({ krTerm, category, subCategory });

    let created = 0;
    for (const c of candidates) {
      await addJpCandidate({
        krTermId: kr.id,
        jpTerm: c.jpTerm,
        jpReading: c.jpReading ?? null,
        scriptType: c.scriptType ?? null,
        matchType: c.matchType ?? null,
        priorityRank: c.priorityRank,
        igHashtagCount: c.igHashtagCount ?? null,
        igCountStatus: 'ESTIMATED',
        exposureLevel: c.exposureLevel ?? null,
        aversionLevel: c.aversionLevel ?? null,
        yakkihouRisk: c.yakkihouRisk ?? null,
        yakkihouNote: c.yakkihouNote ?? null,
        nuanceNote: c.nuanceNote ?? null,
        relatedKeywords: c.relatedKeywords ?? null,
        brandAdoption: c.brandAdoption ?? null,
        source: 'USER',
        verificationStatus: 'PENDING',
      });
      created += 1;
    }

    return NextResponse.json(
      { krTermId: kr.id, krTerm: kr.krTerm, created },
      { status: 201 }
    );
  } catch (err) {
    console.error('[api/trend-words/register]', err);
    return NextResponse.json(
      { error: 'register failed', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
