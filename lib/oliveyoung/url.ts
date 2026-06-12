/**
 * 올리브영 상품 URL 파싱·검증 유틸.
 *
 * 지원 URL 패턴:
 *   https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000247884
 *   https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000247884&...
 *   https://m.oliveyoung.co.kr/m/mtn/goodsDetail.do?goodsNo=A000000247884
 *   oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=...    (스킴 없음)
 *
 * goodsNo 는 보통 `A` + 12자리 숫자(예: A000000247884) 이지만, 안전하게 영숫자 4~20자로 받는다.
 */

export interface ParsedOliveYoungUrl {
  url: string; // 정규화된 URL (https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=<id>)
  productId: string; // goodsNo
  raw: string;
}

const HOST_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?oliveyoung\.co\.kr/i;
const GOODS_NO_RE = /[?&]goodsNo=([A-Za-z0-9]{4,20})/;

export function isOliveYoungUrl(input: string): boolean {
  if (!HOST_RE.test(input)) return false;
  return GOODS_NO_RE.test(input);
}

export function parseOliveYoungUrl(input: string): ParsedOliveYoungUrl | null {
  const trimmed = input.trim();
  if (!HOST_RE.test(trimmed)) return null;
  const productId = GOODS_NO_RE.exec(trimmed)?.[1] ?? null;
  if (!productId) return null;
  return {
    raw: trimmed,
    productId,
    url: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${productId}`,
  };
}
