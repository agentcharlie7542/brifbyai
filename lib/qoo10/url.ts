/**
 * Qoo10 URL 파싱·검증 유틸.
 *
 * 지원 URL 패턴 (Qoo10 Japan):
 *   https://www.qoo10.jp/g/<productId>
 *   https://www.qoo10.jp/g/<productId>/Q/-
 *   https://www.qoo10.jp/g/<productId>?...
 *   qoo10.jp/g/<productId>...     (스킴 없음)
 *
 * 다른 패턴(qoo10.com / qoo10.sg 등)도 동일 g/<id> 구조라 prefix 만 확장하면 됨.
 */

export interface ParsedQoo10Url {
  url: string; // 정규화된 URL (https://www.qoo10.jp/g/<id>)
  productId: string;
  raw: string;
}

const HOST_RE = /^(?:https?:\/\/)?(?:www\.)?qoo10\.jp/i;
const ID_RE = /\/g\/([0-9]+)/;

export function isQoo10Url(input: string): boolean {
  return HOST_RE.test(input) && ID_RE.test(input);
}

export function parseQoo10Url(input: string): ParsedQoo10Url | null {
  const trimmed = input.trim();
  if (!HOST_RE.test(trimmed)) return null;
  const m = ID_RE.exec(trimmed);
  if (!m) return null;
  const productId = m[1];
  return {
    raw: trimmed,
    productId,
    url: `https://www.qoo10.jp/g/${productId}`,
  };
}
