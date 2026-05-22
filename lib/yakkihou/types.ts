export type ProductCategory =
  | 'cosmetic'
  | 'quasi_drug'
  | 'health_food'
  | 'functional_food'
  | 'general_food'
  | 'medical_device'
  | 'general';

export type YakkihouLevel = 'SAFE' | 'WARN' | 'NG';

export interface YakkihouRulePattern {
  id: string;
  /** 이 중 하나라도 문장에 등장하면 매칭 후보가 됩니다. 부분 문자열 매칭. */
  patterns: string[];
  /** 옵션. 지정되면 patterns 중 하나 + 이 목록의 **적어도 하나**가 같은 문장에 공존해야 발동.
   *  예: patterns=['PCOS','PMS','生理痛'] + requires=['改善','効果','効く']
   *      → '질환명 + 효능 동사' 조합만 NG 로 잡고, 질환명 단독 언급(증상 공유 글)은 통과. */
  requires?: string[];
  /** 옵션. 이 목록 중 하나라도 문장에 등장하면 룰 발동을 **억제**.
   *  예: '白くなった気がする' 처럼 완화어(気がする/かも/感じる)가 있으면 NG 격하. */
  excludes?: string[];
  reason: string;
  suggestions: string[];
}

export interface YakkihouFinding {
  text: string;
  startIndex: number;
  endIndex: number;
  level: YakkihouLevel;
  rule: string;
  reason: string;
  suggestions: string[];
  category: ProductCategory;
  /** 어느 레이어가 판정했는지 (디버깅·계측용) */
  layer: 1 | 2 | 3;
}

export interface YakkihouRuleset {
  category: ProductCategory;
  categoryLabel: string;
  description: string;
  ng: YakkihouRulePattern[];
  warn: YakkihouRulePattern[];
  safe: string[];
}
