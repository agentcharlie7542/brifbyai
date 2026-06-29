/**
 * 큐텐 상세페이지 "이미지 캡쳐" — 헤드리스 브라우저로 상세영역을 세로 타일로 스크린샷.
 *
 * 왜 스크린샷인가:
 *  - Qoo10 상세설명은 카피가 긴 이미지에 박혀 있어 HTML 텍스트로는 안 읽힌다.
 *  - 원본 CDN 이미지를 통째로 OCR 하면 너무 길어(예: 800x12000) Vision 이 축소→글자 뭉개짐.
 *  - 뷰포트 높이로 스크롤하며 타일로 캡쳐하면 자연스럽게 "읽기 좋은 크기"로 분할된다.
 *
 * 왜 컨테이너 id 로 영역을 못 정하나:
 *  - Qoo10 상세 마크업(#goods_view_area 등)은 자주 바뀌고, 상단 썸네일 갤러리
 *    (#div_grp_image 류)가 먼저 매치되면 "첫 화면 1장"만 캡쳐되고 정작 아래쪽 긴
 *    상품상세 이미지는 통째로 누락된다(실제 버그). 그래서 id 대신 "콘텐츠"로 탐지한다:
 *    상단 갤러리(접힘선 위)를 건너뛰고, 그 아래에 세로로 쌓인 큰 이미지/풀하이트
 *    상세 iframe 의 범위를 상세영역으로 본다. 마크업이 바뀌어도 동작한다.
 *  - 어떤 경우에도 마지막 폴백은 "문서 전체 타일링"이라 상세 누락이 발생하지 않는다.
 *
 * 캡쳐된 타일(JPEG data URL)은 그대로 화면 표시 + Vision OCR 입력으로 쓰이고,
 * 각 타일은 독립 이미지(여러 장)로 저장되어 타일별 약기법 표기가 이미지 위에 그려진다.
 * 브라우저 런처는 기존 Tier2 와 동일(lib/qoo10/fetcher#launchBrowser) — 서버리스 Chromium 포함.
 */
import type { ScanImage } from '@/lib/inspect/types';
import { launchBrowser, isQueuePage, Qoo10FetchError } from './fetcher';

const VIEWPORT = { width: 820, height: 1180 };
const SCALE = 2; // deviceScaleFactor — 글자 선명도
const JPEG_QUALITY = 78;
const QUEUE_WAIT_MS = 40_000;

/**
 * 비용/시간 상한. 상세영역부터 타일링하므로 헤더에 예산을 낭비하지 않는다.
 * Vercel Hobby(60s) 에선 OCR 이 병목이라 ~12장이 한 요청에서 검수 가능한 현실적 상한.
 * 더 긴 상세는 부분 검수로 처리되고, 필요하면 INSPECT_MAX_TILES 로 올린다.
 */
const MAX_TILES = clampInt(process.env.INSPECT_MAX_TILES, 12, 1, 24);
/** 상단 썸네일 갤러리/요약을 건너뛰기 위한 최소 시작 Y(문서 좌표, CSS px). */
const MIN_DETAIL_TOP = 700;
/** 상세영역으로 인정할 최소 세로 길이. 이보다 짧으면 오탐으로 보고 문서 전체로 폴백. */
const MIN_DETAIL_HEIGHT = 600;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

const QUEUE_HOST_RE = /(?:^|\.)queue-it\.net$|^wait-(?:pc|m)\.qoo10\.jp$/i;

export interface CaptureResult {
  images: ScanImage[];
  finalUrl: string;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export interface CaptureOptions {
  /** 캡쳐 마감 시각(epoch ms). 이 시각이 지나면 타일링을 멈춰 OCR 에 시간을 양보. */
  deadlineAt?: number;
}

export async function captureDetailImages(
  url: string,
  opts: CaptureOptions = {}
): Promise<CaptureResult> {
  const { deadlineAt } = opts;
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

    // 상세 탭 강제 활성화(숨겨진 상세설명 렌더) + 끝까지 스크롤(lazy 이미지 로드)
    await activateDetailTab(page);
    await autoScroll(page);

    const finalUrl = page.url();
    if (isQueuePage(finalUrl, await page.content())) {
      throw new Qoo10FetchError('여전히 Queue-it 대기열 상태', {
        kind: 'queued',
        tier: 'tier2',
      });
    }

    // 상세영역 세로 범위 탐지 (콘텐츠 기반, 실패 시 문서 전체)
    const range = await detectDetailRange(page);
    // 서버 로그로 캡쳐 진단(상세 누락 디버깅용)
    console.info(
      `[detail-images] range=${range.source} top=${range.top} bottom=${range.bottom} ` +
        `docH=${range.docH} blocks=${range.count} maxTiles=${MAX_TILES}`
    );

    // 뷰포트 높이로 스크롤하며 타일 스크린샷 — 상세영역 끝(또는 타일 상한/마감)까지
    const images: ScanImage[] = [];
    let y = Math.max(0, Math.floor(range.top));
    let hitDeadline = false;
    while (y < range.bottom && images.length < MAX_TILES) {
      if (deadlineAt && Date.now() > deadlineAt) {
        hitDeadline = true;
        break;
      }
      await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(140);
      const buf = await page.screenshot({ type: 'jpeg', quality: JPEG_QUALITY });
      images.push({
        dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
        width: VIEWPORT.width * SCALE,
        height: VIEWPORT.height * SCALE,
      });
      y += VIEWPORT.height;
    }
    if (hitDeadline) {
      console.warn(
        `[detail-images] 캡쳐 마감 도달 — ${images.length}장에서 중단(상세가 길어 OCR 시간 확보).`
      );
    }

    if (images.length === 0) {
      throw new Qoo10FetchError('상세페이지에서 캡쳐할 영역을 찾지 못했습니다', {
        kind: 'empty',
        tier: 'tier2',
      });
    }
    if (images.length >= MAX_TILES && range.bottom - range.top > MAX_TILES * VIEWPORT.height) {
      console.warn(
        `[detail-images] 상세가 길어 ${MAX_TILES} 타일에서 잘림. ` +
          `INSPECT_MAX_TILES 로 상한을 올리거나 업로드 모드를 쓰세요.`
      );
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

interface DetailRange {
  top: number;
  bottom: number;
  docH: number;
  /** 'content' = 큰 이미지/iframe 으로 탐지, 'document' = 전체 폴백. 진단용. */
  source: 'content' | 'document';
  count: number;
}

/**
 * 상세영역 [top, bottom] 을 콘텐츠로 탐지.
 *  - 접힘선(MIN_DETAIL_TOP) 아래에 세로로 쌓인 큰 이미지 + 풀하이트 상세 iframe 을 모아
 *    그 최상단~최하단을 상세영역으로 본다(상단 갤러리/요약은 자연히 제외).
 *  - 너무 짧으면(오탐) 문서 전체로 폴백 — 어떤 경우에도 상세를 통째로 놓치지 않게.
 */
async function detectDetailRange(page: import('playwright-core').Page): Promise<DetailRange> {
  return page.evaluate(
    (cfg: { minTop: number; minHeight: number }) => {
      const sy = window.scrollY;
      const docH = Math.max(
        document.body?.scrollHeight ?? 0,
        document.documentElement.scrollHeight,
        document.body?.offsetHeight ?? 0,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      );
      const absRect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top + sy, bottom: r.bottom + sy, w: r.width, h: r.height };
      };

      const blocks: Array<{ top: number; bottom: number }> = [];
      // 상세 슬라이스 = 접힘선 아래 가로로 넓고 충분히 높은 이미지
      for (const im of Array.from(document.images)) {
        const b = absRect(im);
        if (b.w >= 300 && b.h >= 140 && b.top >= cfg.minTop) {
          blocks.push({ top: b.top, bottom: b.bottom });
        }
      }
      // 셀러 상세가 풀하이트 iframe 으로 박혀 있는 경우(인라인 렌더 → 스크린샷에 잡힘)
      for (const fr of Array.from(document.querySelectorAll('iframe'))) {
        const b = absRect(fr);
        if (b.w >= 300 && b.h >= 360 && b.top >= cfg.minTop) {
          blocks.push({ top: b.top, bottom: b.bottom });
        }
      }

      if (blocks.length > 0) {
        const top = Math.min(...blocks.map((b) => b.top));
        const bottom = Math.max(...blocks.map((b) => b.bottom));
        if (bottom - top >= cfg.minHeight) {
          return {
            top: Math.max(0, Math.floor(top)),
            bottom: Math.min(docH, Math.ceil(bottom)),
            docH,
            source: 'content' as const,
            count: blocks.length,
          };
        }
      }
      return { top: 0, bottom: docH, docH, source: 'document' as const, count: blocks.length };
    },
    { minTop: MIN_DETAIL_TOP, minHeight: MIN_DETAIL_HEIGHT }
  );
}

/**
 * "商品詳細/상세설명" 탭을 best-effort 로 클릭해 숨겨진 상세설명을 강제 렌더.
 * 탭 토글 형태(display:none)일 때 콘텐츠 탐지가 0 크기로 누락되는 것을 방지.
 * 페이지 이탈 위험을 피하려고 앵커(#/javascript)·버튼·탭 류만 클릭한다.
 */
async function activateDetailTab(page: import('playwright-core').Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const re = /商品詳細|商品説明|詳細情報|상세설명|상품상세|Details?/i;
      const cands = Array.from(
        document.querySelectorAll('a, button, li, span, div[role="tab"]')
      );
      for (const el of cands) {
        const txt = (el.textContent ?? '').trim();
        if (!txt || txt.length > 12 || !re.test(txt)) continue;
        const tag = el.tagName;
        const href = el.getAttribute('href') ?? '';
        const looksLikeTab =
          (tag === 'A' && /^(#|javascript)/i.test(href)) ||
          tag === 'BUTTON' ||
          tag === 'LI' ||
          el.getAttribute('role') === 'tab' ||
          /tab/i.test(el.className);
        if (looksLikeTab) {
          try {
            (el as HTMLElement).click();
          } catch {
            /* 개별 클릭 실패는 무시 */
          }
        }
      }
    });
    await page.waitForTimeout(400);
  } catch {
    // 탭 활성화는 best-effort — 실패해도 콘텐츠 탐지/문서 폴백으로 진행
  }
}

/** 페이지 끝까지 점진적 스크롤로 lazy 이미지 로드 유도(최대 시간 가드). */
async function autoScroll(page: import('playwright-core').Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const step = 900;
      let ticks = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        ticks += 1;
        const reachedBottom =
          total >= document.documentElement.scrollHeight - window.innerHeight;
        if (reachedBottom || ticks > 45) {
          clearInterval(timer);
          resolve();
        }
      }, 110);
    });
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
}
