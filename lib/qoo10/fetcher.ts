/**
 * Qoo10 페이지 fetch — 3-tier 폴백.
 *  - Tier 1 (fetchProductHtml): 단순 HTTP fetch. 가장 빠르고 기본 경로.
 *  - Tier 2 (fetchProductTier2): 헤드리스 Chrome. Tier 1 이 Queue-it 대기열(봇 차단)에
 *    막혔을 때(kind === 'queued')만 폴백.
 *  - Tier 3: 사용자 수동 입력 (route.ts 에서 처리).
 *
 * 안전 가드:
 *  - 사용자가 명시적으로 "이 URL 가져오기" 액션을 트리거한 경우에만 호출
 *  - User-Agent 에 brifbyai 식별자 포함 (스크래핑 책임 소재 명확)
 *  - 단일 요청 30s 타임아웃
 *  - 403/429 등은 그대로 throw — 호출자가 Tier 3 (수동 입력) 폴백 결정
 */

const USER_AGENT =
  'brifbyai/0.1 (+research; oriented-sheet automation; contact: noreply@example.com)';

export type Qoo10FetchErrorKind = 'http' | 'timeout' | 'empty' | 'queued';

export class Qoo10FetchError extends Error {
  status?: number;
  tier: 'tier1' | 'tier2';
  kind: Qoo10FetchErrorKind;
  constructor(
    message: string,
    opts: { status?: number; tier?: 'tier1' | 'tier2'; kind?: Qoo10FetchErrorKind } = {}
  ) {
    super(message);
    this.name = 'Qoo10FetchError';
    this.status = opts.status;
    this.tier = opts.tier ?? 'tier1';
    this.kind = opts.kind ?? 'http';
  }
}

/**
 * Qoo10 의 Queue-it 가상 대기열(virtual waiting room) 응답 감지.
 * - 대기열은 `wait-pc.qoo10.jp` / `wait-m.qoo10.jp` / `*.queue-it.net` 로 리다이렉트되고,
 *   페이지 `<title>` 이 "Queue-it", `<meta id="queue-it_log">` 가 박혀 있다.
 * - 이 페이지는 상품 데이터가 전혀 없으므로 파싱하면 title 이 "Queue-it" 인 가짜 상품이 나온다.
 */
const QUEUE_HOST_RE = /(?:^|\.)queue-it\.net$|^wait-(?:pc|m)\.qoo10\.jp$/i;

function isQueueHost(host: string): boolean {
  return QUEUE_HOST_RE.test(host);
}

export function isQueuePage(finalUrl: string, html: string): boolean {
  try {
    if (isQueueHost(new URL(finalUrl).host)) return true;
  } catch {
    // finalUrl 파싱 실패는 무시하고 본문 검사로 폴백
  }
  return /id=["']queue-it_log["']|\.queue-it\.net\/|<title[^>]*>\s*Queue-it\s*<\/title>/i.test(
    html
  );
}

/** 이미 파싱·캐시된 데이터가 대기열 페이지 잔재인지 (캐시 오염 가드) */
export function isQueueArtifactTitle(title: string | undefined): boolean {
  return !title || title.trim().toLowerCase() === 'queue-it';
}

/**
 * Tier 2 (헤드리스 브라우저). Tier 1 이 Queue-it 대기열에 막혔을 때만 호출.
 *
 * 실제 브라우저로 페이지를 열어 Queue-it 의 JS 챌린지/대기열을 통과시킨 뒤
 * 렌더된 상품 페이지 HTML 을 회수한다. 대기열이 실제 대기(surge)면 자동
 * 리다이렉트까지 시간이 걸리므로 QUEUE_WAIT_MS 안에 못 빠져나오면 'queued' 로 throw
 * → 호출자가 Tier 3 (수동 입력) 으로 폴백.
 *
 * 브라우저 바이너리 (우선순위):
 *  1. PLAYWRIGHT_CHROMIUM_PATH 환경변수 — 명시적 실행 파일 경로 오버라이드.
 *  2. 서버리스(Vercel/AWS Lambda) — @sparticuz/chromium 번들 Chromium.
 *     playwright-core 는 브라우저를 번들하지 않고 서버리스엔 시스템 Chrome 이 없으므로,
 *     Lambda 호환 Chromium 바이너리를 /tmp 로 풀어서 사용한다.
 *  3. 로컬/일반 서버 — 시스템에 설치된 Google Chrome 채널(channel: 'chrome').
 */
const QUEUE_WAIT_MS = 40_000;

const TIER2_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

/** Vercel / AWS Lambda 등 서버리스 런타임 여부 (시스템 Chrome 부재 → 번들 Chromium 필요) */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launchBrowser() {
  // 동적 import: Tier 1 전용 경로/배포에서는 playwright-core 가 로드되지 않음
  const { chromium } = await import('playwright-core');
  const extraArgs = ['--disable-blink-features=AutomationControlled'];

  // 1) 명시적 바이너리 경로 오버라이드
  const explicitPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (explicitPath) {
    return chromium.launch({
      headless: true,
      executablePath: explicitPath,
      args: ['--no-sandbox', ...extraArgs],
    });
  }

  // 2) 서버리스: @sparticuz/chromium 번들 Chromium
  if (isServerless()) {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    sparticuz.setGraphicsMode = false; // WebGL 불필요 — swiftshader 추출 생략(속도/용량 절감)
    return chromium.launch({
      headless: true,
      executablePath: await sparticuz.executablePath(),
      args: [...sparticuz.args, ...extraArgs],
    });
  }

  // 3) 로컬/일반 서버: 설치된 Chrome 채널
  return chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', ...extraArgs],
  });
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
    // 브라우저 실행 불가(미설치 등) — Tier 2 사용 불가 신호로 queued throw → 수동 폴백
    throw new Qoo10FetchError(
      `Tier 2 브라우저 실행 실패: ${(err as Error).message}`,
      { kind: 'queued', tier: 'tier2' }
    );
  }

  try {
    const context = await browser.newContext({
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      userAgent: TIER2_UA,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Queue-it 대기열로 갔으면 상품 페이지로 자동 리다이렉트될 때까지 대기
    if (isQueueHost(new URL(page.url()).host)) {
      try {
        await page.waitForURL((u) => !isQueueHost(u.host), {
          timeout: QUEUE_WAIT_MS,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        throw new Qoo10FetchError(
          `Queue-it 대기열을 ${QUEUE_WAIT_MS / 1000}s 안에 통과하지 못함 (Tier 2)`,
          { kind: 'queued', tier: 'tier2' }
        );
      }
    }

    await page.waitForLoadState('domcontentloaded');
    const finalUrl = page.url();
    const html = await page.content();
    if (isQueuePage(finalUrl, html)) {
      throw new Qoo10FetchError('여전히 Queue-it 대기열 상태 (Tier 2)', {
        kind: 'queued',
        tier: 'tier2',
      });
    }
    return { html, finalUrl, tier: 'tier2' };
  } catch (err) {
    if (err instanceof Qoo10FetchError) throw err;
    throw new Qoo10FetchError(`Tier 2 fetch 실패: ${(err as Error).message}`, {
      kind: 'http',
      tier: 'tier2',
    });
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
        { status: res.status, kind: 'http' }
      );
    }
    const html = await res.text();
    if (!html || html.length < 200) {
      throw new Qoo10FetchError('Qoo10 응답이 비어 있거나 너무 짧음', { kind: 'empty' });
    }
    // 상품 페이지가 아니라 Queue-it 대기열로 우회된 경우 — 파싱하면 "Queue-it" 가짜 상품이 됨
    if (isQueuePage(res.url, html)) {
      throw new Qoo10FetchError(
        'Qoo10 가 Queue-it 대기열(virtual waiting room)로 우회시켰습니다 — 상품 데이터를 받지 못함',
        { kind: 'queued' }
      );
    }
    return { html, finalUrl: res.url, tier: 'tier1' };
  } catch (err) {
    if (err instanceof Qoo10FetchError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new Qoo10FetchError('Qoo10 fetch timeout (30s)', { kind: 'timeout' });
    }
    throw new Qoo10FetchError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
