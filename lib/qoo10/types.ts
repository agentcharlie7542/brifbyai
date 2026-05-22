export type Qoo10FetchMethod = 'tier1' | 'tier2' | 'tier3_manual';

export interface Qoo10Price {
  current: number;
  original?: number;
  currency: 'JPY';
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
}
