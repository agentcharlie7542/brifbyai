# CLAUDE.md — brifbyai

이 파일은 Claude Code(CLI)가 이 저장소에서 작업할 때 자동으로 컨텍스트로 읽는 가이드입니다.

## 프로젝트 개요

**brifbyai** — 멀티 브랜드 오리엔트시트 자동 생성 + 일본 약기법(薬機法) 검증 플랫폼.

- 도메인: 인플루언서팀 오리엔트시트 + 약기법 검증
- 초기 브랜드: 동아제약, 아이힐(Aiheal, 확장 가능 구조)
- 주력 채널: Qoo10 Japan
- 핵심 가치: Qoo10 상품 URL 1개 + 브랜드 선택 → 약기법 검증된 시트 초안 5분 내 생성

전체 PRD는 [docs/prd-v2.md](docs/prd-v2.md) 참조.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS + shadcn/ui |
| DB | Vercel Postgres + Drizzle ORM |
| 스토리지 | Vercel Blob (PDF) |
| AI | Anthropic Claude API (Opus 4.7) |
| PDF 파싱 | pdf-parse |
| Qoo10 파싱 | Cheerio + Playwright (3-tier 폴백) |
| 배포 | Vercel |

## 코딩 규칙

- TypeScript **strict** 모드 유지. `any`는 명시적으로 정당화될 때만 사용.
- 모든 API 라우트는 `try/catch` + 표준 에러 응답 형식 사용.
- 약기법 관련 코드는 반드시 [lib/yakkihou/](lib/yakkihou/) 하위에만 작성.
- Qoo10 fetch는 반드시 3-tier 폴백(`lib/qoo10/fetcher.ts`)을 거칠 것. 직접 `fetch()`로 Qoo10 페이지를 가져오지 말 것.
- 사용자가 입력한 Claude API 키는 절대 서버 로그/DB에 남기지 않는다. 응답 후 즉시 폐기.
- shadcn/ui 컴포넌트는 [components/ui/](components/ui/)에 두고, 그 위 비즈니스 컴포넌트는 [components/](components/) 루트에 둔다.
- 파일 import는 `@/...` 절대경로 사용 (tsconfig paths).

## 약기법 검증 규칙

- 단계는 **SAFE / WARN / NG 3단계만** 사용. 다른 레벨 추가 금지.
- 모든 finding은 `reason`(왜 위반인지)과 `suggestions`(대체 표현)을 반드시 포함.
- 카테고리별 룰셋: [lib/yakkihou/rules/](lib/yakkihou/rules/) 하위 JSON.
  - `cosmetic.json` — 화장품 56효능 기준
  - `health_food.json` — 일반 건강식품
  - `quasi_drug.json` — 의약부외품 (승인 효능은 product.approvedClaims 참조)
  - `general_food.json` — 일반 식품
- 3-layer 검증 순서는 변경하지 말 것: (1) 하드 NG 키워드 → (2) 위험 패턴 매칭 → (3) Claude 판정. LLM은 ambiguous한 문장에만 호출해 비용을 통제.

## 데이터 모델 (Drizzle)

[db/schema.ts](db/schema.ts) 참조. 핵심 테이블:

- `brands` — 멀티 브랜드 (동아제약, 아이힐)
- `products` — `category` enum(cosmetic/health_food/...)과 `qoo10Url` 보유
- `reference_sheets` — PDF 학습 데이터
- `sheets` — 생성된 오리엔트시트
- `yakkihou_findings` — 시트별 약기법 검증 결과

스키마 변경 시:
```bash
npm run db:generate   # 마이그레이션 SQL 생성
npm run db:migrate    # 적용
```

## 환경변수

| 키 | 용도 |
|---|---|
| `LOGIN_PASSWORD` | 앱 전체 비밀번호 게이트 |
| `CLAUDE_ADMIN_KEY` | 서버 측 PDF 파싱·약기법 LLM 판정용 |
| `POSTGRES_URL` | Vercel Postgres 연결 문자열 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (PDF 저장) |

`.env.example` 참조. 사용자가 직접 입력하는 시트 생성용 Claude 키는 환경변수가 아니라 요청 본문으로 전달.

## 디렉터리 구조

```
brifbyai/
├── app/                  # Next.js App Router
│   ├── (main)/           # 인증 후 접근 가능한 메인 라우트들
│   ├── admin/seed/       # PDF 일괄 업로드 페이지
│   ├── new/              # 새 시트 생성 페이지
│   ├── login/            # 비밀번호 게이트
│   └── api/              # API 라우트 (Phase 1~)
├── components/
│   ├── ui/               # shadcn/ui primitives
│   └── yakkihou-*.tsx    # 약기법 표시용 컴포넌트
├── db/
│   ├── schema.ts         # Drizzle 스키마
│   └── migrations/       # 자동 생성
├── lib/
│   ├── auth.ts           # 비밀번호 토큰
│   ├── utils.ts          # cn(), 공용 유틸
│   └── yakkihou/
│       ├── types.ts
│       ├── rules/        # 카테고리별 JSON 룰
│       └── validator.ts  # (Phase 2)
├── docs/
│   └── prd-v2.md         # 본 프로젝트의 PRD
├── middleware.ts         # 비밀번호 게이트
└── CLAUDE.md             # 이 파일
```

## 테스트

- 약기법 검증 변경 시 `tests/yakkihou/*.test.ts` 반드시 실행 (Phase 2 이후 작성).
- Qoo10 파서 변경 시 `tests/fixtures/qoo10/*.html`로 회귀 테스트.

## Claude Code 활용 팁

- 새 약기법 룰 추가: `lib/yakkihou/rules/<카테고리>.json`을 직접 편집. 검증 코드 변경 불요.
- Qoo10 셀렉터 변경: `tests/fixtures/qoo10/`에 실제 HTML 캐싱본을 두고 회귀 시험.
- 새 API 라우트: `app/api/<도메인>/<액션>/route.ts` 패턴. zod로 입력 스키마 검증.

## 참고 문서

- 본 PRD: [docs/prd-v2.md](docs/prd-v2.md)
- 약기법 룰 출처 메모: docs/yakkihou-sources.md (예정)
