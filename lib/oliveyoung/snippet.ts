/**
 * 올리브영 상품 페이지에서 직접 실행하는 추출 스니펫.
 *
 * 왜 필요한가:
 *   올리브영 WAF 가 Vercel/데이터센터 egress IP 를 평판 점수로 차단하기 때문에
 *   서버에서 Tier 1/2 모두 막힌다. 사용자가 자기 브라우저(주거용 IP) 에서
 *   상품 페이지를 연 상태로 이 스니펫을 한 번 실행하면 JSON-LD/OG/DOM 을
 *   조합해 상품 데이터를 추출 → 클립보드 복사 → 우리 폼에 붙여넣어 자동 채움.
 *
 * 두 가지 사용법:
 *   1. DevTools 콘솔에 한 줄로 붙여넣기 (`RAW_SNIPPET`)
 *   2. 북마클릿: 브라우저 즐겨찾기에 `BOOKMARKLET_URL` 을 저장, 상품 페이지에서 한 번 클릭
 *
 * 출력 JSON 모양 (route.ts 의 manual 스키마와 정합):
 *   { title, brand?, price?, currency:'KRW', description?, imageUrl?, category?, url, productId, source:'oliveyoung' }
 */

/**
 * 원본 스니펫 본문. UI 에 보여줄 때는 그대로 노출하고, 북마클릿 URL 은
 * 이 문자열을 percent-encode 해서 만든다 — 즉 단일 진실 소스.
 */
export const RAW_SNIPPET = `(() => {
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap(s => { try { const j = JSON.parse(s.textContent); return Array.isArray(j) ? j : (j['@graph'] || [j]); } catch { return []; } })
    .find(x => x && (Array.isArray(x['@type']) ? x['@type'].includes('Product') : x['@type'] === 'Product')) || {};
  const meta = p => document.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]')?.content;
  const text = s => document.querySelector(s)?.textContent?.trim();
  const num = v => { if (v == null) return undefined; const c = String(v).replace(/[^\\d.]/g, ''); return c ? Number(c) : undefined; };
  const stripSuffix = t => (t || '').replace(/\\s*-\\s*올리브영\\s*$/u, '').replace(/\\s*\\|\\s*올리브영\\s*$/u, '').trim();
  const out = {
    title: ld.name || stripSuffix(meta('og:title')) || text('.prd_name') || text('.goods_name'),
    brand: (typeof ld.brand === 'string' ? ld.brand : ld.brand?.name) || text('.prd_brand a') || text('.prd_brand') || meta('og:product:brand') || meta('product:brand'),
    price: num(ld.offers?.price) ?? num(meta('og:product:price:amount')) ?? num(meta('product:price:amount')) ?? num(text('.price-2 strong')) ?? num(text('.price strong')),
    currency: 'KRW',
    description: ld.description || meta('og:description') || meta('description'),
    imageUrl: (Array.isArray(ld.image) ? ld.image[0] : ld.image) || meta('og:image') || document.querySelector('#mainImg img, .prd_thumb_img img')?.src,
    category: ld.category || [...document.querySelectorAll('.loc_history a, .breadcrumb a')].map(a => a.textContent.trim()).filter(Boolean).join(' / ') || undefined,
    url: location.href,
    productId: new URLSearchParams(location.search).get('goodsNo') || undefined,
    source: 'oliveyoung',
  };
  const json = JSON.stringify(out, null, 2);
  const done = ok => alert('brifbyai · 올리브영 추출\\n\\n' + (ok ? '✓ 클립보드 복사 완료' : '⚠ 클립보드 권한 없음 — 콘솔에서 JSON 복사하세요') + '\\n\\n' + (out.title || '(상품명 추출 실패)'));
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(() => done(true)).catch(() => { console.log(json); done(false); });
  } else {
    console.log(json);
    done(false);
  }
  return out;
})();`;

/**
 * 북마클릿 URL: `javascript:` + percent-encoded 본문.
 * 사용자가 즐겨찾기에 드래그하면 한 번 클릭으로 동일 동작.
 */
export const BOOKMARKLET_URL = `javascript:${encodeURIComponent(RAW_SNIPPET)}`;
