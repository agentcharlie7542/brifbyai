import cosmetic from './rules/cosmetic.json';
import healthFood from './rules/health_food.json';
import quasiDrug from './rules/quasi_drug.json';
import generalFood from './rules/general_food.json';

import type { ProductCategory, YakkihouRuleset } from './types';

const TABLE: Record<string, YakkihouRuleset | undefined> = {
  cosmetic: cosmetic as YakkihouRuleset,
  health_food: healthFood as YakkihouRuleset,
  quasi_drug: quasiDrug as YakkihouRuleset,
  general_food: generalFood as YakkihouRuleset,
  // functional_food / medical_device / general 은 미구현 — fallback
};

const EMPTY_RULESET: YakkihouRuleset = {
  category: 'general',
  categoryLabel: '一般',
  description: '룰셋 미구현 카테고리. Layer 1·2 패스, Layer 3(Claude)만 동작.',
  ng: [],
  warn: [],
  safe: [],
};

export function getRuleset(category: ProductCategory): YakkihouRuleset {
  return TABLE[category] ?? EMPTY_RULESET;
}
