/**
 * 메인 검증 엔트리. Layer 1 → 2 → 3 순서로 적용.
 *
 *   text          전체 입력 (단락·여러 문장 통째)
 *   sentences[]   세그먼터로 미리 잘라 둔 문장 배열 (옵션, 미지정 시 자동 분할)
 *   category      약기법 카테고리
 *   apiKey        Layer 3 (Claude) 호출용. 없으면 Layer 3 스킵
 *
 * 같은 문장에서 NG 가 잡히면 Layer 2/3 는 추가로 호출하지 않음(중복 라벨 방지).
 */
import type { ProductCategory, YakkihouFinding } from './types';
import { segment as defaultSegment, type Segment } from './segmenter';
import { getRuleset } from './rules';
import { runLayer1, runLayer2 } from './layers';
import { runLayer3 } from './claude-judge';

export interface ValidateOptions {
  text: string;
  category: ProductCategory;
  apiKey?: string;
  modelOverride?: string;
  /** Layer 3 (Claude) 호출 비활성화. 룰셋만으로 빠른 검증할 때. */
  skipLayer3?: boolean;
  /** 미리 분할된 세그먼트를 외부에서 주입할 때. */
  segments?: Segment[];
}

export interface ValidateResult {
  segments: Segment[];
  findings: YakkihouFinding[];
  summary: { safe: number; warn: number; ng: number };
  /** 레이어별 finding 카운트 — 계측·디버깅 용 */
  layerCounts: { layer1: number; layer2: number; layer3: number };
}

export async function validate(opts: ValidateOptions): Promise<ValidateResult> {
  const segments = opts.segments ?? defaultSegment(opts.text);
  const ruleset = getRuleset(opts.category);

  const findings: YakkihouFinding[] = [];
  const ngSentenceIndices = new Set<number>();

  // ── Layer 1: hard NG ─────────────────────────────────────────
  segments.forEach((seg, idx) => {
    const hits = runLayer1(seg, ruleset);
    if (hits.length > 0) {
      findings.push(...hits);
      ngSentenceIndices.add(idx);
    }
  });

  // ── Layer 2: warn 패턴 (Layer 1 에서 NG 잡힌 문장은 스킵) ───
  segments.forEach((seg, idx) => {
    if (ngSentenceIndices.has(idx)) return;
    findings.push(...runLayer2(seg, ruleset));
  });

  // ── Layer 3: Claude 판정 (rule 매칭 0건 인 문장만) ─────────
  const findingSentenceIndices = new Set(
    findings.map((f) =>
      segments.findIndex(
        (s) => f.startIndex >= s.startIndex && f.endIndex <= s.endIndex
      )
    )
  );

  let layer3Count = 0;
  if (!opts.skipLayer3 && opts.apiKey) {
    const ambiguous = segments.filter((_, i) => !findingSentenceIndices.has(i));
    if (ambiguous.length > 0) {
      try {
        const l3 = await runLayer3(
          ambiguous,
          ruleset,
          opts.apiKey,
          opts.modelOverride
        );
        findings.push(...l3);
        layer3Count = l3.length;
      } catch (err) {
        // Layer 3 실패는 전체 검증을 막지 않음 — Layer 1·2 결과만 반환
        console.warn(
          '[yakkihou] Layer 3 (Claude) 실패 — Layer 1·2 결과만 반환:',
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const summary = {
    safe: segments.length - new Set(
      findings.map((f) =>
        segments.findIndex(
          (s) => f.startIndex >= s.startIndex && f.endIndex <= s.endIndex
        )
      )
    ).size,
    warn: findings.filter((f) => f.level === 'WARN').length,
    ng: findings.filter((f) => f.level === 'NG').length,
  };

  return {
    segments,
    findings,
    summary,
    layerCounts: {
      layer1: findings.filter((f) => f.layer === 1).length,
      layer2: findings.filter((f) => f.layer === 2).length,
      layer3: layer3Count,
    },
  };
}
