/**
 * Qoo10 페이지 fetch (Tier 1).
 *
 * 안전 가드:
 *  - 사용자가 명시적으로 "이 URL 가져오기" 액션을 트리거한 경우에만 호출
 *  - User-Agent 에 brifbyai 식별자 포함 (스크래핑 책임 소재 명확)
 *  - 단일 요청 30s 타임아웃
 *  - 403/429 등은 그대로 throw — 호출자가 Tier 3 (수동 입력) 폴백 결정
 *
 * Tier 2 (Playwright + 일본 IP 프록시) 는 의존성/인프라가 무거워 MVP 에서는 생략.
 *   필요해지면 fetcher.ts 에 fetchTier2 추가하고 fetchProductHtml 이 폴백.
 */

const USER_AGENT =
  'brifbyai/0.1 (+research; oriented-sheet automation; contact: noreply@example.com)';

export class Qoo10FetchError extends Error {
  status?: number;
  tier: 'tier1' | 'tier2';
  constructor(message: string, opts: { status?: number; tier?: 'tier1' | 'tier2' } = {}) {
    super(message);
    this.name = 'Qoo10FetchError';
    this.status = opts.status;
    this.tier = opts.tier ?? 'tier1';
  }
}

export async function fetchProductHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
  tier: 'tier1';
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        'accept-language': 'ja-JP,ja;q=0.9,en;q=0.5',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Qoo10FetchError(
        `Qoo10 fetch failed (HTTP ${res.status})`,
        { status: res.status }
      );
    }
    const html = await res.text();
    if (!html || html.length < 200) {
      throw new Qoo10FetchError('Qoo10 응답이 비어 있거나 너무 짧음');
    }
    return { html, finalUrl: res.url, tier: 'tier1' };
  } catch (err) {
    if (err instanceof Qoo10FetchError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new Qoo10FetchError('Qoo10 fetch timeout (30s)');
    }
    throw new Qoo10FetchError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
