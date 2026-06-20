# PRD — 상세페이지 검수 (Page Inspector)

> 큐텐 상품 링크 → 상세페이지 이미지 캡쳐 → Vision OCR → 약기법 검수 → 문제 문구 체크 표기 + 수정안.
> 기존 "오리엔트시트 생성"과 분리된 **별도 메뉴**. 약기법 판정 엔진은 기존 [lib/yakkihou/](../lib/yakkihou/) 그대로 재사용.

## 상태 (2026-06-20)

- **구현 완료 (Phase 0~2)**: 메뉴/라우트/엔진 연결 + URL 자동 캡쳐 + 이미지 업로드 + Vision OCR + 약기법 검수 + 이미지 박스 오버레이 + 텍스트 하이라이트 + 전체 수정본 복사. `npm run typecheck`·`next lint` 통과.
- 캡쳐 방식은 **헤드리스 뷰포트 타일 스크린샷**으로 구현(원본 CDN `<img>` 추출 대신 — 별도 이미지 처리 라이브러리 불필요, 자연 분할로 OCR 가독성 확보).
- 미구현(향후): 검수 이력 DB 저장(Phase 3), 진행률 스트리밍, OCR/캡쳐 캐싱.

## 0. 확정 결정 (2026-06-20)

| 항목 | 결정 |
|---|---|
| 이미지 텍스트 인식 | **Claude Vision OCR** (`@anthropic-ai/sdk`, 신규 인프라 0) |
| 이미지 위 표기 | **블록 박스 오버레이 + 추출 텍스트 하이라이트** (정확도+위치감 동시 확보) |
| 결과 저장 | **무상태 MVP** (기존 `/validate` 플레이그라운드와 동일, DB 변경 없음) |
| 메뉴 이름 | **상세페이지 검수** (사이드바 Tools 섹션, 경로 `/inspect`) |

## 1. 배경 & 문제

- 큐텐 재팬 상품 상세설명은 **텍스트가 아니라 긴 이미지에 카피가 박혀** 있다.
- 기존 [lib/qoo10/parser.ts](../lib/qoo10/parser.ts)의 HTML 텍스트 파서는 이 이미지 속 문구를 읽지 못한다.
- 약기법 위반(薬機法)은 바로 이 이미지 카피에서 가장 많이 발생 → **이미지 캡쳐 + OCR**이 필요.
- 약기법 판정 엔진 [lib/yakkihou/validator.ts](../lib/yakkihou/validator.ts)는 `텍스트 + 카테고리 → findings(startIndex/endIndex 포함)` 구조라 **입력원과 무관하게 재사용 가능**.

## 2. 사용자 플로우

```
[1] 사이드바 Tools > "상세페이지 검수"
[2] 큐텐 URL 붙여넣기 + 상품 종류 선택 (健康食品/化粧品/医薬部外品/一般食品/機能性表示食品/一般)
[3] "검수 시작" → 진행률 (이미지 수집 N장 → OCR → 약기법 판정)
[4] 결과: 좌측 이미지 + NG🔴/WARN🟡 블록 박스 / 우측 finding 리스트 + 수정안
        박스·칩 클릭 → 이유 + 권장 대체표현
[5] "전체 수정본" → OCR 텍스트에 권장 표현 일괄 적용 정리본 → 복사
```

## 3. 파이프라인

```
큐텐 URL ─ parseQoo10Url ─ Playwright 렌더(Tier2 재사용, 스크롤로 lazy-load 강제)
   ├─(주) 상세영역 <img> URL 추출 → 다운로드 → 리사이즈
   ├─(폴백) 상세 컨테이너 풀페이지 스크린샷 세로 슬라이스
   ├─(병행) 이미지 아닌 실제 HTML 텍스트 블록도 수집
   ▼
이미지[]/텍스트블록[] ─ Claude Vision OCR ─ 블록[]{ text, bbox(0~1 정규화), imageIndex }
   ▼
블록 텍스트 ─ validate({ text, category }) ← 기존 엔진 (Layer1 룰→Layer2 패턴→Layer3 Claude)
   ▼
findings[] ─ 블록·이미지 역매핑 ─ UI(이미지 박스 오버레이 + 텍스트 하이라이트 + 수정안)
```

## 4. 추가/수정 파일

```
신규:
  app/(workspace)/inspect/page.tsx          # 메뉴 페이지 (서버 컴포넌트)
  app/(workspace)/inspect/inspect-client.tsx# URL 입력·진행·결과 클라이언트
  app/api/inspect/route.ts                   # 수집→OCR→검증 오케스트레이션
  lib/qoo10/detail-images.ts                 # 상세 <img> URL 추출 + 스크린샷 폴백
  lib/ocr/vision.ts                          # Claude Vision OCR (블록+bbox 반환)
  lib/inspect/orchestrator.ts                # 파이프라인 결합 + findings 역매핑
  lib/inspect/types.ts                       # ScanResult / OcrBlock 타입
  components/inspect-overlay.tsx             # 이미지 위 NG/WARN 박스 오버레이

수정:
  components/brand-sidebar.tsx               # Tools 섹션에 "상세페이지 검수" 링크 1줄
```

> CLAUDE.md 규칙 준수: 약기법 판정 로직은 [lib/yakkihou/](../lib/yakkihou/) 밖으로 새지 않는다. 신규 코드는 수집·OCR·매핑만 담당하고 판정은 `validate()`만 호출한다.

## 5. 데이터 계약 (초안)

```ts
// lib/inspect/types.ts
interface OcrBlock {
  imageIndex: number;
  text: string;
  bbox: { x: number; y: number; w: number; h: number }; // 0~1 정규화
}
interface ScanImage { url: string; width: number; height: number; }
interface ScanResult {
  source: { url: string; productId: string };
  category: ProductCategory;
  images: ScanImage[];
  blocks: OcrBlock[];
  findings: YakkihouFinding[];          // 기존 타입 그대로
  blockFindings: Array<{ blockIndex: number; findingIndexes: number[] }>; // 역매핑
  summary: { safe: number; warn: number; ng: number };
}
```

- `/api/inspect` 응답 = `ScanResult`. 무상태이므로 DB 미저장. (이력 필요 시 Phase 3에서 `page_scans` 테이블 추가)

## 6. Vision OCR 설계 (`lib/ocr/vision.ts`)

- `@anthropic-ai/sdk`로 이미지(base64) 전달, 시스템 프롬프트로 **읽기순서 보존 + 블록별 정규화 bbox** JSON 반환 요구.
- 모델: 기본 `claude-sonnet-4-6` (비용/정확도 균형), `CLAUDE_MODEL` 또는 요청 오버라이드 허용 — [claude-judge.ts](../lib/yakkihou/claude-judge.ts) 패턴 동일.
- 서버 키 `CLAUDE_ADMIN_KEY` 사용. 사용자 입력 키는 요청 본문 전달(로그·DB 미기록).
- 비용 절감: 이미지 리사이즈(장변 캡), 장수 캡, URL 해시 캐싱([lib/qoo10/cache.ts](../lib/qoo10/cache.ts) 패턴).

## 7. UI (`inspect-client.tsx` + `inspect-overlay.tsx`)

- 카테고리 셀렉트는 기존 `CATEGORY_OPTIONS` 재사용 ([yakkihou-validator.tsx](../components/yakkihou-validator.tsx)).
- 이미지 오버레이: 각 이미지를 컨테이너에 `relative`로 깔고, finding 있는 블록 bbox를 `%` 좌표 절대배치 박스로. NG=red/WARN=yellow. 클릭 → 팝오버(이유+권장표현).
- 텍스트 패널: 기존 `FindingChip`/`applySuggestion` 로직 재사용해 정확한 문구 하이라이트 + 클릭 교체.
- "전체 수정본": 모든 권장 표현 일괄 적용본 생성 → 클립보드 복사 / 마크다운.

## 8. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| OCR 비용/지연(긴 이미지 다수) | 리사이즈·장수 캡·병렬·URL 해시 캐싱 |
| Vercel 60s 함수 한도 | 이미지 분할 처리 + 진행률 표시, 초과 시 비동기 잡(v2) |
| Queue-it 봇 차단 | 기존 Tier2 우회 재사용, 실패 시 수동 이미지 업로드 폴백 |
| OCR 오인식 → 오탐/누락 | 추출 텍스트를 화면 노출해 사람 검증 가능(현 엔진 철학) |
| 법적 책임 | "사람 최종 확인 필요" 보조 도구 명시 |

## 9. 단계별 개발 계획

- **Phase 0 (반나절)**: 메뉴/라우트 스캐폴딩 + 이미지 직접 업로드 → OCR → `validate()` 텍스트 결과 (엔진 연결 검증).
- **Phase 1 (MVP)**: 큐텐 URL → 상세 이미지 자동 수집 → OCR → 검증 → 추출 텍스트 하이라이트 + finding 리스트 + 수정안.
- **Phase 2**: 이미지 위 블록 박스 오버레이 + 전체 수정본 내보내기.
- **Phase 3 (옵션)**: `page_scans` 이력 저장 + 오리엔트시트 생성 연동.

## 10. 완료 기준 (MVP)

- 큐텐 상품 URL + 카테고리 입력만으로 상세 이미지 카피의 NG/WARN 문구가 텍스트·이미지 양쪽에 표기되고, 각 문구에 권장 대체표현이 제시되며, 전체 수정본을 복사할 수 있다.
