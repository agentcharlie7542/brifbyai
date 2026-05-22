/**
 * Layer 1 (hard NG keywords) 와 Layer 2 (warn patterns) 구현.
 *
 * 둘 다 룰셋 JSON 의 patterns 를 부분 문자열로 스캔.
 * `requires` 가 지정된 룰은 모든 토큰이 같은 문장에 함께 등장해야 매칭.
 *
 * 호출자는 Layer 1 결과를 먼저 적용해 NG 가 잡힌 문장은 Layer 2/3 스킵.
 */
import type {
  ProductCategory,
  YakkihouFinding,
  YakkihouRulePattern,
  YakkihouRuleset,
} from './types';
import type { Segment } from './segmenter';

function findMatch(sentence: string, rule: YakkihouRulePattern): string | null {
  const trigger = rule.patterns.find((p) => sentence.includes(p));
  if (!trigger) return null;
  if (rule.requires && rule.requires.length > 0) {
    const hasAnyRequired = rule.requires.some((r) => sentence.includes(r));
    if (!hasAnyRequired) return null;
  }
  if (rule.excludes && rule.excludes.length > 0) {
    const hasAnyExcluder = rule.excludes.some((e) => sentence.includes(e));
    if (hasAnyExcluder) return null;
  }
  return trigger;
}

function applyRules(
  segment: Segment,
  rules: YakkihouRulePattern[],
  level: 'NG' | 'WARN',
  category: ProductCategory,
  layer: 1 | 2
): YakkihouFinding[] {
  const findings: YakkihouFinding[] = [];
  for (const rule of rules) {
    const trigger = findMatch(segment.text, rule);
    if (!trigger) continue;
    const localStart = segment.text.indexOf(trigger);
    findings.push({
      text: trigger,
      startIndex: segment.startIndex + localStart,
      endIndex: segment.startIndex + localStart + trigger.length,
      level,
      rule: rule.id,
      reason: rule.reason,
      suggestions: rule.suggestions,
      category,
      layer,
    });
  }
  return findings;
}

export function runLayer1(
  segment: Segment,
  ruleset: YakkihouRuleset
): YakkihouFinding[] {
  return applyRules(segment, ruleset.ng, 'NG', ruleset.category, 1);
}

export function runLayer2(
  segment: Segment,
  ruleset: YakkihouRuleset
): YakkihouFinding[] {
  return applyRules(segment, ruleset.warn, 'WARN', ruleset.category, 2);
}
