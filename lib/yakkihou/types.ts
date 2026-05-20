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
  patterns: string[];
  reason: string;
  suggestions: string[];
}

export interface YakkihouRuleset {
  category: ProductCategory;
  categoryLabel: string;
  description: string;
  ng: YakkihouRulePattern[];
  warn: YakkihouRulePattern[];
  safe: string[];
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
}
