/**
 * 올리브영(oliveyoung.co.kr) 상품 페이지 fetch — 3-tier 폴백.
 *
 *  - Tier 1 (fetchProductHtml): 단순 HTTP fetch.
 *    실제로 올리브영은 거의 항상 "잠시만 기다려 주세요" 봇 차단 페이지를 반환하므로
 *    빠른 경로일 뿐 성공률은 낮다. 'wall' 감지되면 즉시 throw → Tier 2 폴백.
 *  - Tier 2 (fetchProductTier2): 헤드리스 Chrome (playwright-core).
 *    실제 브라우저로 JS 챌린지를 통과시키고 렌더된 상세 페이지 HTML 을 회수한다.
 *  - Tier 3: 사용자 수동 입력 (route.ts 에서 처리).
 *
 * Qoo10 Tier 2 (lib/qoo10/fetcher.ts) 와 같은 브라우저 launch 전략을 그대로 사용.
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

export type OliveYoungFetchErrorKind = 'http' | 'timeout' | 'empty' | 'wall';

export class OliveYoungFetchError extends Error {
  status?: number;
  tier: 'tier1' | 'tier2';
  kind: OliveYoungFetchErrorKind;
  constructor(
    message: string,
    opts: {
      status?: number;
      tier?: 'tier1' | 'tier2';
      kind?: OliveYoungFetchErrorKind;
    } = {}
  ) {
    super(message);
    this.name = 'OliveYoungFetchError';
    this.status = opts.status;
    this.tier = opts.tier ?? 'tier1';
    this.kind = opts.kind ?? 'http';
  }
}

/**
 * 올리브영의 봇 차단 "잠시만 기다려 주세요" 페이지 감지.
 * - title 이 "잠시만 기다려 주세요 - 올리브영" 류
 * - 본문에 상품 상세 마커(goodsNm, og:product 등)가 전혀 없음
 */
const WALL_TITLE_RE = /<title[^>]*>\s*잠시만\s*기다려\s*주세요[^<]*<\/title>/i;
const PRODUCT_MARKER_RE =
  /og:product|"goodsNm"|"goodsNo"\s*:|<meta[^>]+property=["']product:price/i;

export function isWallPage(html: string): boolean {
  if (WALL_TITLE_RE.test(html)) return true;
  // 잠시만 기다려 주세요 페이지는 상품 마커가 전혀 없다
  if (html.length < 80_000 && !PRODUCT_MARKER_RE.test(html)) {
    // 명확한 wall 시그니처는 없지만 상품 마커가 없는 짧은 페이지 = 거의 wall
    return /window\.location|setTimeout\(.*location/i.test(html);
  }
  return false;
}

/** 이미 파싱·캐시된 데이터가 wall 페이지 잔재인지 (캐시 오염 가드) */
export function isWallArtifactTitle(title: string | undefined): boolean {
  if (!title) return true;
  const t = title.trim();
  return /^잠시만\s*기다려\s*주세요/.test(t);
}

const TIER2_UA = USER_AGENT;

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launchBrowser() {
  const { chromium } = await import('playwright-core');
  const extraArgs = ['--disable-blink-features=AutomationControlled'];

  const explicitPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (explicitPath) {
    return chromium.launch({
      headless: true,
      executablePath: explicitPath,
      args: ['--no-sandbox', ...extraArgs],
    });
  }

  if (isServerless()) {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    sparticuz.setGraphicsMode = false;
    return chromium.launch({
      headless: true,
      executablePath: await sparticuz.executablePath(),
      args: [...sparticuz.args, ...extraArgs],
    });
  }

  return chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', ...extraArgs],
  });
}

const WALL_WAIT_MS = 25_000;

export async function fetchProductTier2(url: string): Promise<{
  html: string;
  finalUrl: string;
  tier: 'tier2';
}> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
  } catch (err) {
    throw new OliveYoungFetchError(
      `Tier 2 브라우저 실행 실패: ${(err as Error).message}`,
      { kind: 'wall', tier: 'tier2' }
    );
  }

  try {
    const context = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      userAgent: TIER2_UA,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 봇 차단 페이지면 자동 리다이렉트(자체 JS) 까지 대기
    let html = await page.content();
    if (isWallPage(html)) {
      try {
        await page.waitForFunction(
          () =>
            !/잠시만\s*기다려/.test(document.title) &&
            !!document.querySelector(
              'meta[property="og:title"], .prd_name, .goods_name'
            ),
          undefined,
          { timeout: WALL_WAIT_MS }
        );
      } catch {
        throw new OliveYoungFetchError(
          `올리브영 봇 차단 페이지를 ${WALL_WAIT_MS / 1000}s 안에 통과하지 못함 (Tier 2)`,
          { kind: 'wall', tier: 'tier2' }
        );
      }
    }
    // 상품 상세에서 가격/이미지가 비동기 렌더되는 케이스 대응
    await page
      .waitForSelector('meta[property="og:title"]', { timeout: 5_000 })
      .catch(() => {});

    const finalUrl = page.url();
    html = await page.content();
    if (isWallPage(html)) {
      throw new OliveYoungFetchError('여전히 봇 차단 페이지 상태 (Tier 2)', {
        kind: 'wall',
        tier: 'tier2',
      });
    }
    return { html, finalUrl, tier: 'tier2' };
  } catch (err) {
    if (err instanceof OliveYoungFetchError) throw err;
    throw new OliveYoungFetchError(
      `Tier 2 fetch 실패: ${(err as Error).message}`,
      { kind: 'http', tier: 'tier2' }
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function fetchProductHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
  tier: 'tier1';
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.5',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'upgrade-insecure-requests': '1',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new OliveYoungFetchError(
        `올리브영 fetch failed (HTTP ${res.status})`,
        { status: res.status, kind: 'http' }
      );
    }
    const html = await res.text();
    if (!html || html.length < 200) {
      throw new OliveYoungFetchError('올리브영 응답이 비어 있거나 너무 짧음', {
        kind: 'empty',
      });
    }
    if (isWallPage(html)) {
      throw new OliveYoungFetchError(
        '올리브영 봇 차단 페이지(잠시만 기다려 주세요)로 우회됨 — Tier 2 폴백 필요',
        { kind: 'wall' }
      );
    }
    return { html, finalUrl: res.url, tier: 'tier1' };
  } catch (err) {
    if (err instanceof OliveYoungFetchError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new OliveYoungFetchError('올리브영 fetch timeout (25s)', {
        kind: 'timeout',
      });
    }
    throw new OliveYoungFetchError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
