// 임시 진단 라우트 — Vercel→Qoo10 연결성 확인용. 커밋/배포 후 삭제.
import { NextResponse } from 'next/server';
import { fetchProductTier2 } from '@/lib/qoo10/fetcher';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DIAG_KEY = 'diag-7k2p9';

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get('k') !== DIAG_KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const target =
    u.searchParams.get('url') || 'https://www.qoo10.jp/g/1147395628';
  const doTier2 = u.searchParams.get('tier2') === '1';

  const out: Record<string, unknown> = {
    target,
    onVercel: Boolean(process.env.VERCEL),
    region: process.env.VERCEL_REGION ?? null,
  };

  // --- Tier 1: raw fetch (cause 코드까지 캡처) ---
  const t0 = Date.now();
  try {
    const res = await fetch(target, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'accept-language': 'ja-JP,ja;q=0.9,en;q=0.5',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '')
      .trim()
      .slice(0, 100);
    out.tier1 = {
      ok: true,
      status: res.status,
      finalUrl: res.url,
      htmlLen: html.length,
      title,
      isQueue: /wait-(?:pc|m)\.qoo10\.jp|queue-it/i.test(res.url + title),
      ms: Date.now() - t0,
    };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    out.tier1 = {
      ok: false,
      name: e.name,
      message: e.message,
      causeCode: e.cause?.code ?? null,
      causeMessage: e.cause?.message ?? null,
      ms: Date.now() - t0,
    };
  }

  // --- Tier 2: headless chromium (요청 시) ---
  if (doTier2) {
    const t1 = Date.now();
    try {
      const { html, finalUrl } = await fetchProductTier2(target);
      const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '')
        .trim()
        .slice(0, 100);
      out.tier2 = { ok: true, finalUrl, htmlLen: html.length, title, ms: Date.now() - t1 };
    } catch (err) {
      const e = err as Error & { kind?: string };
      out.tier2 = {
        ok: false,
        name: e.name,
        kind: e.kind ?? null,
        message: e.message,
        ms: Date.now() - t1,
      };
    }
  }

  return NextResponse.json(out);
}
