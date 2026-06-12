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
  // 추가 stealth 플래그: webdriver flag 숨김 + 자동화 흔적 제거.
  // 올리브영의 WAF 는 navigator.webdriver / chromium 자동화 시그니처를 보고 페이지를 즉시 종료한다.
  const extraArgs = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process,SitePerProcess',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--disable-infobars',
  ];

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

const WALL_WAIT_MS = 20_000;

/**
 * 안전한 page.content() — 페이지가 이미 닫혔거나 컨텍스트가 destroy 됐으면 null 반환.
 * Playwright 가 `Target page, context or browser has been closed` 로 throw 하는 경우 다수.
 */
async function safeContent(page: import('playwright-core').Page): Promise<string | null> {
  try {
    return await page.content();
  } catch {
    return null;
  }
}

async function safeUrl(page: import('playwright-core').Page): Promise<string | null> {
  try {
    return page.url();
  } catch {
    return null;
  }
}

/**
 * Tier 2 단일 시도. URL/UA 를 바꿔가며 호출하기 위해 분리.
 */
async function tier2Attempt(
  browser: Awaited<ReturnType<typeof launchBrowser>>,
  url: string,
  userAgent: string,
  viewport: { width: number; height: number }
): Promise<{ html: string; finalUrl: string }> {
  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent,
    viewport,
    extraHTTPHeaders: {
      'accept-language': 'ko-KR,ko;q=0.9,en;q=0.5',
    },
  });

  // 자동화 시그니처 제거 — webdriver, chrome.runtime, permissions.query 등.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // @ts-expect-error chrome 객체 모킹 (헤드리스에서는 없음)
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // 1) 봇 차단(잠시만 기다려) 인지 → 상품 마커 등장까지 대기
    //    waitForSelector 는 navigation 도중에도 안전 (waitForFunction 은 page 닫히면 throw)
    try {
      await page.waitForSelector(
        'meta[property="og:title"], meta[property="og:image"], .prd_name, .goods_name, #goodsInfo',
        { timeout: WALL_WAIT_MS, state: 'attached' }
      );
    } catch {
      // 마커 못 봄 → 여전히 wall 이거나 페이지가 닫혔거나
      const stillWallHtml = await safeContent(page);
      if (!stillWallHtml) {
        throw new OliveYoungFetchError(
          '봇 검출로 페이지/컨텍스트가 닫힘',
          { kind: 'wall', tier: 'tier2' }
        );
      }
      if (isWallPage(stillWallHtml)) {
        throw new OliveYoungFetchError(
          `올리브영 봇 차단 페이지를 ${WALL_WAIT_MS / 1000}s 안에 통과하지 못함 (Tier 2)`,
          { kind: 'wall', tier: 'tier2' }
        );
      }
      // 마커는 없지만 wall 도 아닌 경우 — 그대로 진행해 본다
    }

    const finalUrl = (await safeUrl(page)) ?? url;
    const html = await safeContent(page);
    if (!html) {
      throw new OliveYoungFetchError(
        '봇 검출로 페이지/컨텍스트가 닫힘 (content 읽기 전)',
        { kind: 'wall', tier: 'tier2' }
      );
    }
    if (isWallPage(html)) {
      throw new OliveYoungFetchError('여전히 봇 차단 페이지 상태 (Tier 2)', {
        kind: 'wall',
        tier: 'tier2',
      });
    }
    return { html, finalUrl };
  } finally {
    await context.close().catch(() => {});
  }
}

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
    // 1차: PC UA + PC URL
    try {
      const r = await tier2Attempt(browser, url, TIER2_UA, {
        width: 1280,
        height: 900,
      });
      return { ...r, tier: 'tier2' };
    } catch (e1) {
      if (!(e1 instanceof OliveYoungFetchError) || e1.kind !== 'wall') {
        throw e1;
      }
      // 2차: 모바일 UA + 모바일 도메인 (봇 검출 강도가 더 약한 경향)
      const mobileUrl = url.replace(
        /^https?:\/\/(?:www\.)?oliveyoung\.co\.kr\/store\/goods\/getGoodsDetail\.do/,
        'https://m.oliveyoung.co.kr/m/mtn/goodsDetail.do'
      );
      const mobileUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      try {
        const r = await tier2Attempt(browser, mobileUrl, mobileUa, {
          width: 390,
          height: 844,
        });
        return { ...r, tier: 'tier2' };
      } catch (e2) {
        if (e2 instanceof OliveYoungFetchError) throw e2;
        throw new OliveYoungFetchError(
          `Tier 2(모바일) 도 실패: ${(e2 as Error).message}`,
          { kind: 'wall', tier: 'tier2' }
        );
      }
    }
  } catch (err) {
    if (err instanceof OliveYoungFetchError) throw err;
    // Playwright 의 raw 메시지 (Target page... closed 등) 를 사용자 친화적으로 번역
    const raw = (err as Error).message || '';
    const isClosed = /Target page.*closed|context.*closed|browser.*closed/i.test(
      raw
    );
    throw new OliveYoungFetchError(
      isClosed
        ? '올리브영 봇 검출로 페이지가 닫혔습니다. 잠시 후 다시 시도하거나 수동 입력 폴백을 사용하세요.'
        : `Tier 2 fetch 실패: ${raw}`,
      { kind: 'wall', tier: 'tier2' }
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
      // 올리브영은 봇 차단 시 HTTP 403 (+ 본문이 "잠시만 기다려 주세요" 페이지) 으로 응답한다.
      // → 403 은 'wall' 로 분류해 Tier 2(Playwright) 폴백을 자동 트리거.
      const kind: OliveYoungFetchErrorKind =
        res.status === 403 ? 'wall' : 'http';
      throw new OliveYoungFetchError(
        `올리브영 fetch failed (HTTP ${res.status})`,
        { status: res.status, kind }
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
