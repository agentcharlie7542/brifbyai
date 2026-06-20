/**
 * 큐텐 상세페이지 "이미지 캡쳐" — 헤드리스 브라우저로 상세영역을 세로 타일로 스크린샷.
 *
 * 왜 스크린샷인가:
 *  - Qoo10 상세설명은 카피가 긴 이미지에 박혀 있어 HTML 텍스트로는 안 읽힌다.
 *  - 원본 CDN 이미지를 통째로 OCR 하면 너무 길어(예: 800x12000) Vision 이 축소→글자 뭉개짐.
 *  - 뷰포트 높이로 스크롤하며 타일로 캡쳐하면 자연스럽게 "읽기 좋은 크기"로 분할된다.
 *
 * 캡쳐된 타일(JPEG data URL)은 그대로 화면 표시 + Vision OCR 입력으로 쓰인다.
 * 브라우저 런처는 기존 Tier2 와 동일(lib/qoo10/fetcher#launchBrowser) — 서버리스 Chromium 포함.
 */
import type { ScanImage } from '@/lib/inspect/types';
import { launchBrowser, isQueuePage, Qoo10FetchError } from './fetcher';

const VIEWPORT = { width: 820, height: 1180 };
const SCALE = 2; // deviceScaleFactor — 글자 선명도
const MAX_TILES = 12; // 비용/시간 상한
const JPEG_QUALITY = 78;
const QUEUE_WAIT_MS = 40_000;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

/** 상세 컨테이너 후보. 마크업이 자주 바뀌므로 best-effort, 실패 시 전체 문서. */
const DETAIL_SELECTORS = [
  '#goods_view_area',
  '#div_grp_image',
  '#objArea',
  '.goods_detail',
  '[class*="detail_view"]',
  '[class*="goods_detail"]',
];

const QUEUE_HOST_RE = /(?:^|\.)queue-it\.net$|^wait-(?:pc|m)\.qoo10\.jp$/i;

export interface CaptureResult {
  images: ScanImage[];
  finalUrl: string;
}

export async function captureDetailImages(url: string): Promise<CaptureResult> {
  let browser: Awaited<ReturnType<typeof launchBrowser>>;
  try {
    browser = await launchBrowser();
  } catch (err) {
    throw new Qoo10FetchError(
      `헤드리스 브라우저 실행 실패: ${(err as Error).message}. 이미지 직접 업로드 모드를 사용하세요.`,
      { kind: 'queued', tier: 'tier2' }
    );
  }

  try {
    const context = await browser.newContext({
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      userAgent: UA,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Queue-it 가상 대기열 통과 대기 (Tier2 와 동일 정책)
    if (QUEUE_HOST_RE.test(new URL(page.url()).host)) {
      try {
        await page.waitForURL((u) => !QUEUE_HOST_RE.test(u.host), {
          timeout: QUEUE_WAIT_MS,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        throw new Qoo10FetchError(
          `Queue-it 대기열을 ${QUEUE_WAIT_MS / 1000}s 안에 통과하지 못함`,
          { kind: 'queued', tier: 'tier2' }
        );
      }
    }
    await page.waitForLoadState('domcontentloaded');

    // lazy-load 이미지 강제: 끝까지 천천히 스크롤
    await autoScroll(page);

    const finalUrl = page.url();
    if (isQueuePage(finalUrl, await page.content())) {
      throw new Qoo10FetchError('여전히 Queue-it 대기열 상태', {
        kind: 'queued',
        tier: 'tier2',
      });
    }

    // 상세 컨테이너 세로 범위 탐지 (없으면 전체 문서)
    const range = await page.evaluate((selectors: string[]) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          const top = r.top + window.scrollY;
          const height = el.scrollHeight || r.height;
          if (height > 400) return { top, bottom: top + height };
        }
      }
      return { top: 0, bottom: document.documentElement.scrollHeight };
    }, DETAIL_SELECTORS);

    // 뷰포트 높이로 스크롤하며 타일 스크린샷
    const images: ScanImage[] = [];
    let y = Math.max(0, Math.floor(range.top));
    while (y < range.bottom && images.length < MAX_TILES) {
      await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(160);
      const buf = await page.screenshot({ type: 'jpeg', quality: JPEG_QUALITY });
      images.push({
        dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
        width: VIEWPORT.width * SCALE,
        height: VIEWPORT.height * SCALE,
      });
      y += VIEWPORT.height;
    }

    if (images.length === 0) {
      throw new Qoo10FetchError('상세페이지에서 캡쳐할 영역을 찾지 못했습니다', {
        kind: 'empty',
        tier: 'tier2',
      });
    }
    return { images, finalUrl };
  } catch (err) {
    if (err instanceof Qoo10FetchError) throw err;
    throw new Qoo10FetchError(`상세페이지 캡쳐 실패: ${(err as Error).message}`, {
      kind: 'http',
      tier: 'tier2',
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

/** 페이지 끝까지 점진적 스크롤로 lazy 이미지 로드 유도(최대 시간 가드). */
async function autoScroll(page: import('playwright-core').Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const step = 700;
      let ticks = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        ticks += 1;
        const reachedBottom =
          total >= document.documentElement.scrollHeight - window.innerHeight;
        if (reachedBottom || ticks > 80) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
}
