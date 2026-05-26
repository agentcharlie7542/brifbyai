/**
 * Qoo10 URL 파싱·검증 유틸.
 *
 * 지원 URL 패턴 (Qoo10 Japan):
 *   https://www.qoo10.jp/g/<productId>
 *   https://www.qoo10.jp/g/<productId>/Q/-
 *   https://www.qoo10.jp/g/<productId>?...
 *   https://www.qoo10.jp/item/<slug>/<productId>?...   (SEO URL)
 *   qoo10.jp/g/<productId>...                          (스킴 없음)
 */

export interface ParsedQoo10Url {
  url: string; // 정규화된 URL (https://www.qoo10.jp/g/<id>)
  productId: string;
  raw: string;
}

const HOST_RE = /^(?:https?:\/\/)?(?:www\.)?qoo10\.jp/i;
const ID_G_RE = /\/g\/([0-9]+)/;
const ID_ITEM_RE = /\/item\/[^/?#]+\/([0-9]+)(?:[/?#]|$)/;

export function isQoo10Url(input: string): boolean {
  if (!HOST_RE.test(input)) return false;
  return ID_G_RE.test(input) || ID_ITEM_RE.test(input);
}

export function parseQoo10Url(input: string): ParsedQoo10Url | null {
  const trimmed = input.trim();
  if (!HOST_RE.test(trimmed)) return null;
  const productId =
    ID_G_RE.exec(trimmed)?.[1] ?? ID_ITEM_RE.exec(trimmed)?.[1] ?? null;
  if (!productId) return null;
  return {
    raw: trimmed,
    productId,
    url: `https://www.qoo10.jp/g/${productId}`,
  };
}
