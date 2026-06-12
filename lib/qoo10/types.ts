export type Qoo10FetchMethod = 'tier1' | 'tier2' | 'tier3_manual';

/**
 * 상품 데이터의 수집 소스.
 * - `qoo10` (기본/하위호환): Qoo10 Japan
 * - `oliveyoung`: 올리브영 코리아
 *
 * 신규 소스를 추가할 때마다 이 union 만 확장.
 */
export type ProductSource = 'qoo10' | 'oliveyoung';

export interface Qoo10Price {
  current: number;
  original?: number;
  /** 가격 통화. Qoo10=JPY, OliveYoung=KRW */
  currency: 'JPY' | 'KRW';
}

export interface Qoo10ReviewSummary {
  count: number;
  avgRating: number;
  topKeywords?: string[];
}

export interface Qoo10ProductData {
  url: string;
  productId: string;
  title: string;
  titleKo?: string;
  price?: Qoo10Price;
  category?: string;
  seller?: string;
  description?: string;
  features?: string[];
  images?: string[];
  reviewSummary?: Qoo10ReviewSummary;
  fetchedAt: string;
  fetchMethod: Qoo10FetchMethod;
  /**
   * 수집 소스. 없으면 'qoo10' 로 간주 (기존 저장 데이터 하위호환).
   */
  source?: ProductSource;
  /** Olive Young 등 브랜드 텍스트가 별도로 노출되는 소스용 */
  brand?: string;
}
