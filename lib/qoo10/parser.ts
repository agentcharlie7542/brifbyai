/**
 * Qoo10 상품 HTML → Qoo10ProductData.
 *
 * 신호 우선순위:
 *   1. JSON-LD (schema.org Product) — 가장 신뢰
 *   2. OpenGraph 메타 태그 — 두 번째로 신뢰
 *   3. Qoo10 특화 DOM 셀렉터 — best-effort, HTML 마크업이 자주 변하므로 fragile
 *
 * 모든 필드가 누락되어도 throw 하지 않음 (호출자가 ProductData 검증해서
 * 빈 필드는 사용자 수동 입력 또는 LLM 추측으로 보충).
 */
import * as cheerio from 'cheerio';
import type { Qoo10ProductData } from './types';

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

export function parseQoo10Html(
  html: string,
  productId: string,
  url: string
): Qoo10ProductData {
  const $ = cheerio.load(html);
  const ld = extractJsonLd($);

  // ── title ────────────────────────────────────────────────
  const title =
    ld?.name?.trim() ||
    metaContent($, 'og:title') ||
    $('title').first().text().trim() ||
    '';

  // ── description ─────────────────────────────────────────
  const description =
    ld?.description?.trim() ||
    metaContent($, 'og:description') ||
    metaContent($, 'description') ||
    undefined;

  // ── images ──────────────────────────────────────────────
  const ldImages = arrayify(ld?.image).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );
  const ogImage = metaContent($, 'og:image');
  const images = Array.from(
    new Set([...ldImages, ...(ogImage ? [ogImage] : [])])
  );

  // ── price ───────────────────────────────────────────────
  const ldPrice = parseNumber(ld?.offers?.price);
  // OG 가격 메타: og:product:price:amount / product:price:amount
  const ogPrice =
    parseNumber(metaContent($, 'og:product:price:amount')) ??
    parseNumber(metaContent($, 'product:price:amount'));
  const price = ldPrice ?? ogPrice;

  // ── seller ──────────────────────────────────────────────
  let seller: string | undefined;
  if (ld?.offers?.seller) {
    seller =
      typeof ld.offers.seller === 'string'
        ? ld.offers.seller
        : ld.offers.seller.name;
  }

  // ── category ────────────────────────────────────────────
  const category = ld?.category?.trim() || undefined;

  // ── review summary ──────────────────────────────────────
  let reviewSummary: Qoo10ProductData['reviewSummary'] | undefined;
  const rating = parseNumber(ld?.aggregateRating?.ratingValue);
  const count = parseNumber(ld?.aggregateRating?.reviewCount);
  if (rating != null && count != null) {
    reviewSummary = { avgRating: rating, count };
  }

  // ── features (best-effort: bullet list 텍스트 수집) ─────
  // Qoo10 상품 상세는 #goods_view_area / .detail / .product-detail 류에 들어가는 경우가 흔함.
  // 마크업 의존이라 실패해도 무방.
  const features: string[] = [];
  const featureSel = [
    '#goods_view_area li',
    '.product-detail li',
    '.detail-section li',
    'meta[name="keywords"]',
  ];
  for (const sel of featureSel) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
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
    price: price != null ? { current: price, currency: 'JPY' } : undefined,
    seller,
    category,
    reviewSummary,
    features: features.length > 0 ? features.slice(0, 30) : undefined,
    fetchedAt: new Date().toISOString(),
    fetchMethod: 'tier1',
  };
}
