/**
 * 올리브영(oliveyoung.co.kr) 상품 HTML → Qoo10ProductData 호환 객체.
 *
 * 신호 우선순위:
 *   1. JSON-LD (schema.org Product) — 있다면 가장 신뢰
 *   2. OpenGraph 메타 (og:title, og:image, og:product:price:amount, og:product:brand)
 *   3. 올리브영 특화 DOM 셀렉터 (.prd_name / .prd_brand / .price-2 strong 등) — 마크업이
 *      자주 변하므로 깨지면 OG/LD 로 폴백.
 *
 * 출력 타입은 기존 Qoo10ProductData 를 재사용하되 `source: 'oliveyoung'`,
 * 통화 `KRW` 로 채운다. 시트 생성기·캐시·UI 가 같은 모양을 공유 → 분기 최소화.
 */
import * as cheerio from 'cheerio';
import type { Qoo10ProductData } from '@/lib/qoo10/types';

interface ProductLd {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[];
  brand?: { name?: string } | string;
  category?: string;
  offers?: {
    price?: string | number;
    priceCurrency?: string;
    seller?: { name?: string } | string;
  };
  aggregateRating?: {
    ratingValue?: string | number;
    reviewCount?: string | number;
  };
}

function arrayify<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractJsonLd($: cheerio.CheerioAPI): ProductLd | null {
  for (const node of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(node).contents().text();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];
      for (const item of items) {
        const t = arrayify(item['@type']);
        if (t.some((x: string) => String(x).toLowerCase() === 'product')) {
          return item as ProductLd;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function metaContent($: cheerio.CheerioAPI, prop: string): string | undefined {
  const el = $(`meta[property="${prop}"], meta[name="${prop}"]`).first();
  const c = el.attr('content');
  return c && c.trim() ? c.trim() : undefined;
}

function parseNumber(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[^\d.]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function textOf($: cheerio.CheerioAPI, sel: string): string | undefined {
  const t = $(sel).first().text().trim();
  return t || undefined;
}

function normalizeTitle(raw: string): string {
  // 올리브영 og:title 은 종종 "<상품명> - 올리브영" 또는 "<브랜드> | <상품명>" 형태.
  return raw
    .replace(/\s*-\s*올리브영\s*$/u, '')
    .replace(/\s*\|\s*올리브영\s*$/u, '')
    .trim();
}

export function parseOliveYoungHtml(
  html: string,
  productId: string,
  url: string
): Qoo10ProductData {
  const $ = cheerio.load(html);
  const ld = extractJsonLd($);

  // ── title ─────────────────────────────────────────────────
  const rawTitle =
    ld?.name?.trim() ||
    textOf($, '.prd_name') ||
    textOf($, '.goods_name') ||
    metaContent($, 'og:title') ||
    $('title').first().text().trim() ||
    '';
  const title = normalizeTitle(rawTitle);

  // ── brand ─────────────────────────────────────────────────
  let brand: string | undefined;
  if (ld?.brand) {
    brand = typeof ld.brand === 'string' ? ld.brand : ld.brand.name;
  }
  brand =
    brand ||
    textOf($, '.prd_brand a') ||
    textOf($, '.prd_brand') ||
    metaContent($, 'og:product:brand') ||
    metaContent($, 'product:brand') ||
    undefined;

  // ── description ───────────────────────────────────────────
  const description =
    ld?.description?.trim() ||
    metaContent($, 'og:description') ||
    metaContent($, 'description') ||
    undefined;

  // ── images ────────────────────────────────────────────────
  const ldImages = arrayify(ld?.image).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );
  const ogImage = metaContent($, 'og:image');
  const domMain = $('#mainImg img, .prd_thumb_img img').first().attr('src');
  const images = Array.from(
    new Set(
      [
        ...ldImages,
        ogImage,
        domMain && domMain.startsWith('//') ? `https:${domMain}` : domMain,
      ].filter((s): s is string => !!s)
    )
  );

  // ── price ─────────────────────────────────────────────────
  // LD > OG > DOM(.price-2 strong / .price strong)
  const ldPrice = parseNumber(ld?.offers?.price);
  const ogPrice =
    parseNumber(metaContent($, 'og:product:price:amount')) ??
    parseNumber(metaContent($, 'product:price:amount'));
  const domSale =
    parseNumber(textOf($, '.price-2 strong')) ??
    parseNumber(textOf($, '.price strong')) ??
    parseNumber(textOf($, 'span.price'));
  const current = ldPrice ?? ogPrice ?? domSale;
  const original = parseNumber(textOf($, '.price-1, .price del, span.del'));

  // ── seller (오프라인/브랜드명으로 대체) ─────────────────────
  let seller: string | undefined;
  if (ld?.offers?.seller) {
    seller =
      typeof ld.offers.seller === 'string'
        ? ld.offers.seller
        : ld.offers.seller.name;
  }
  if (!seller) seller = brand;

  // ── category (breadcrumb 가 있으면) ────────────────────────
  const category =
    ld?.category?.trim() ||
    $('.loc_history a')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join(' / ') ||
    undefined;

  // ── review summary ────────────────────────────────────────
  let reviewSummary: Qoo10ProductData['reviewSummary'] | undefined;
  const ldRating = parseNumber(ld?.aggregateRating?.ratingValue);
  const ldCount = parseNumber(ld?.aggregateRating?.reviewCount);
  const domRating =
    ldRating ??
    parseNumber(textOf($, '#repReview .review_point strong')) ??
    parseNumber(textOf($, '.review_star strong'));
  const domCount =
    ldCount ??
    parseNumber(textOf($, '#repReview .review_total em')) ??
    parseNumber(textOf($, '.review_count'));
  if (domRating != null && domCount != null) {
    reviewSummary = { avgRating: domRating, count: domCount };
  }

  // ── features (best-effort: 주요 효능/특징 리스트) ───────────
  // 올리브영 상세 페이지의 "주요 특징" / "제품 정보" 영역. 마크업 의존이라 깨져도 무방.
  const features: string[] = [];
  const featureSel = [
    '#prdMain .prd_detail li',
    '.prd_info_list li',
    '.prd_promotion li',
    '.detail_area li',
    'meta[name="keywords"]',
  ];
  for (const sel of featureSel) {
    $(sel).each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t && t.length > 1 && t.length < 200) features.push(t);
    });
    if (features.length > 0) break;
  }

  return {
    url,
    productId,
    title,
    description,
    images,
    price:
      current != null
        ? { current, original, currency: 'KRW' }
        : undefined,
    seller,
    brand,
    category,
    reviewSummary,
    features: features.length > 0 ? features.slice(0, 30) : undefined,
    fetchedAt: new Date().toISOString(),
    fetchMethod: 'tier1',
    source: 'oliveyoung',
  };
}
