# brifbyai

멀티 브랜드 오리엔트시트 자동 생성 + 일본 약기법(薬機法) 검증 플랫폼.

> Qoo10 상품 URL 1개 + 브랜드 선택 → 약기법 검증된 시트 초안을 **5분** 내에.

상세 기획은 [docs/prd-v2.md](docs/prd-v2.md), 개발 가이드는 [CLAUDE.md](CLAUDE.md)를 참조하세요.

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
# .env.local 편집

# 3. 개발 서버
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속. `LOGIN_PASSWORD`를 비워 두면 로그인 게이트가 우회됩니다(로컬 편의).

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 검사 |
| `npm run db:generate` | Drizzle 마이그레이션 생성 |
| `npm run db:migrate` | 마이그레이션 적용 |
| `npm run db:studio` | Drizzle Studio |

## 현재 상태

- ✅ **Phase 0** — 스캐폴딩, CLAUDE.md, 비밀번호 게이트, 기본 페이지
- ⬜ Phase 1 — PDF 학습 데이터 파이프라인
- ⬜ Phase 2 — 약기법 검증 엔진
- ⬜ Phase 3 — 시트 에디터 + 인라인 검증 UI
- ⬜ Phase 4 — Qoo10 파싱 통합
- ⬜ Phase 5 — E2E + 첫 운영
