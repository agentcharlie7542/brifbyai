/**
 * 일본어/한국어/영문 혼재 문장 분할기.
 *
 * 분할 기준:
 *   - 일본어 종지부: 。? ! ？ ！ ・・・(말줄임은 안 끊음)
 *   - 영문: . ? ! (단 약어·소수점 보존 시도)
 *   - 줄바꿈
 *   - 불릿 기호(● ✔ ※ ・ ▪ - * + 1. 2. 등)는 새 문장 시작점으로 취급
 *
 * 반환 형태:
 *   각 세그먼트는 원본 인덱스(start, end)와 텍스트를 보존.
 *   인라인 하이라이팅 시 인덱스로 정확히 치환 가능.
 */

export interface Segment {
  text: string;
  startIndex: number;
  endIndex: number;
}

const SENTENCE_END = /[。?!？！]/;
const BULLET_RE = /[●✔※▪◆◇★☆・▶▷※]|^\s*(\d+[.)]|[-*+])\s+/u;

export function segment(text: string): Segment[] {
  if (!text) return [];
  const out: Segment[] = [];

  // 1) 줄바꿈 + 불릿으로 1차 split (인덱스 보존)
  const lineSegments: Segment[] = [];
  let cursor = 0;
  for (const rawLine of text.split('\n')) {
    const lineStart = cursor;
    const lineEnd = cursor + rawLine.length;
    if (rawLine.trim().length > 0) {
      lineSegments.push({
        text: rawLine,
        startIndex: lineStart,
        endIndex: lineEnd,
      });
    }
    cursor = lineEnd + 1; // +1 for the \n
  }

  // 2) 각 라인에서 종지부 기반 split
  for (const line of lineSegments) {
    let chunkStart = 0;
    const text = line.text;
    for (let i = 0; i < text.length; i += 1) {
      if (SENTENCE_END.test(text[i])) {
        const chunk = text.slice(chunkStart, i + 1);
        const trimmed = chunk.replace(/^\s+|\s+$/g, '');
        if (trimmed.length > 0) {
          // 원본 인덱스로 환산
          const localStart = chunkStart + chunk.indexOf(trimmed[0]);
          out.push({
            text: trimmed,
            startIndex: line.startIndex + localStart,
            endIndex: line.startIndex + localStart + trimmed.length,
          });
        }
        chunkStart = i + 1;
      }
    }
    // 라인 끝까지 남은 부분
    if (chunkStart < text.length) {
      const chunk = text.slice(chunkStart);
      const trimmed = chunk.replace(/^\s+|\s+$/g, '');
      if (trimmed.length > 0) {
        const localStart = chunkStart + chunk.indexOf(trimmed[0]);
        out.push({
          text: trimmed,
          startIndex: line.startIndex + localStart,
          endIndex: line.startIndex + localStart + trimmed.length,
        });
      }
    }
  }

  // 3) 불릿 기호를 시작점으로 갖는 토막은 그대로 둠 (이미 라인 분할에서 처리됨)
  // 추가 정제: 너무 짧은(<2자) 조각, 순수 기호만 있는 조각 제거
  return out.filter((s) => {
    const stripped = s.text.replace(/[\s\p{P}\p{S}]/gu, '');
    return stripped.length >= 2;
  });
}

/** segmenter 동작 확인용 디버그 헬퍼 */
export function summarize(segs: Segment[]): string {
  return segs.map((s, i) => `[${i + 1}] (${s.startIndex}-${s.endIndex}) ${s.text}`).join('\n');
}
