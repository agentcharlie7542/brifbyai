# brifbyai

**멀티 브랜드 오리엔트 시트 자동 생성 + 약기법 검증 플랫폼**

| 항목 | 내용 |
|---|---|
| **프로젝트명** | brifbyai (브리프 바이 AI) |
| **버전** | v2.0 |
| **작성일** | 2026.05.20 |
| **도메인** | 멀티 브랜드 인플루언서 협업 브리프 + 약기법 검증 |
| **초기 브랜드** | 동아제약, 아이힐 (확장 가능 구조) |
| **주요 채널** | Qoo10 Japan 중심, 향후 채널 확장 |
| **배포** | github.com/agentcharlie7542/brifbyai → Vercel |
| **개발 환경** | VS Code + Claude Code (CLI 페어 코딩) |
| **기술 스택** | Next.js 14 / Claude API / Postgres |

> **v1.0 대비 주요 변경**: 멀티 브랜드 / PDF 학습 / Qoo10 / 일본 약기법 검증 / VS Code + Claude Code

---

## 목차

1. [v1.0 → v2.0 주요 변경점](#1-v10--v20-주요-변경점)
2. [멀티 브랜드 데이터 모델](#2-멀티-브랜드-데이터-모델)
3. [PDF 기반 학습 파이프라인](#3-pdf-기반-학습-파이프라인)
4. [Qoo10 상품 링크 자동 처리](#4-qoo10-상품-링크-자동-처리)
5. [일본 약기법 자동 검증 시스템](#5-일본-약기법薬機法-자동-검증-시스템)
6. [오리엔트 시트 양식 (v2.0 재정의)](#6-오리엔트-시트-양식-v20-재정의)
7. [기술 스택 (v2.0)](#7-기술-스택-v20)
8. [VS Code + Claude Code 개발 환경](#8-vs-code--claude-code-개발-환경)
9. [핵심 사용자 시나리오](#9-핵심-사용자-시나리오-v20)
10. [개발 로드맵](#10-개발-로드맵-v20)
11. [리스크 / 미해결 이슈](#11-리스크--미해결-이슈)
12. [다음 액션](#12-다음-액션)

---

## 1. v1.0 → v2.0 주요 변경점

v1.0이 동아제약 단일 브랜드 / 구글 시트 기반 / 일반 검수 수준이었다면, v2.0은 다음 5가지 축으로 본격 확장된다.

| 변경 축 | v1.0 | v2.0 |
|---|---|---|
| **브랜드 범위** | 동아제약 단일 (확장 가능 구조만 마련) | 동아제약 + 아이힐(Aiheal) 동시 운영, n개 확장 전제 |
| **학습 데이터 소스** | 구글 시트 47개 (권한 이슈 존재) | PDF 첨부 30+개 → 파싱·임베딩 (권한 무관) |
| **상품 입력** | 수동 입력 또는 관리자가 사전 등록 | Qoo10 상품 URL 붙여넣기 → 자동 파싱 + 시트 초안 생성 |
| **법규 검증** | 프롬프트에 ‘금지 표현 주의’ 수준 | 일본 약기법(薬機法) 기반 3단계 자동 검증 + 시트 인라인 표시 |
| **개발 워크플로우** | 미정 (일반 IDE) | VS Code + Claude Code (CLI). 본 문서를 컨텍스트로 활용 |

> ### 🎯 v2.0의 핵심 가치 제안
> - Qoo10 상품 링크 1개 + 브랜드 선택만으로 → 약기법 검증된 오리엔트 시트 초안 자동 생성
> - 시트 본문의 모든 문장은 약기법 3단계 (안전 / 주의 / 위반)로 색상 코드화
> - 30개+ 과거 사례 PDF가 컨텍스트로 자동 주입되어 톤·구조가 일관됨
> - **‘시트 한 장 만드는 데 1시간’ → ‘5분’으로 단축**

---

## 2. 멀티 브랜드 데이터 모델

### 2.1 브랜드 계층 구조

기존 ‘브랜드 → 상품 → 시트’ 3단계를 유지하되, 브랜드별로 약기법 분류(화장품/의약부외품/건강식품/일반식품/잡화)와 적용 시장(일본/한국/글로벌)을 명시해 검증 룰을 분기시킨다.

```typescript
// types/brand.ts
export type ProductCategory =
  | 'cosmetic'              // 化粧品 - 56가지 효능 표현 한정
  | 'quasi_drug'            // 医薬部外品 - 승인된 효능만 가능
  | 'health_food'           // 健康食品 - 의약품적 표현 금지
  | 'functional_food'       // 機能性表示食品 - 신고된 기능만 표시
  | 'general_food'          // 一般食品 - 의약품적 표현 금지
  | 'medical_device'        // 医療機器 - 승인 효능만
  | 'general';              // 잡화

export type TargetMarket = 'jp' | 'kr' | 'global';

export interface Brand {
  id: string;
  name: string;             // '동아제약', '아이힐'
  nameJa?: string;          // 일본어 표기
  logoUrl?: string;
  defaultMarket: TargetMarket;
  defaultTone?: string;
  brandGuideUrl?: string;   // PDF로 첨부된 브랜드 가이드
  createdAt: string;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  nameJa?: string;
  category: ProductCategory;     // 약기법 분류 핵심
  targetMarket: TargetMarket;
  qoo10Url?: string;             // Qoo10 상품 URL
  qoo10Data?: Qoo10ProductData;  // 파싱된 상품 정보 (캐시)
  approvedClaims?: string[];     // 승인된 효능 표현 (의약부외품·기능성표시식품 한정)
  keyIngredients?: string[];
  targetAudience?: string;
  referenceSheets: SheetReference[]; // PDF 30+개 매핑
}

export interface SheetReference {
  id: string;
  fileName: string;        // 'whitathione_2025_summer.pdf'
  storageUrl: string;      // Vercel Blob 등 스토리지 경로
  parsedText: string;      // PDF 파싱 결과
  embedding?: number[];    // 시맨틱 검색용 (v2.5)
  uploadedAt: string;
}
```

### 2.2 초기 브랜드 시드

| 브랜드 | 주요 시장 | 주요 카테고리 | 초기 상품 | PDF 시드 수 |
|---|---|---|---|---|
| **동아제약** | 한국·일본 | 健康食品 / 化粧品 | 6종+ | 47건 (구글시트 → PDF 전환) |
| **아이힐 (Aiheal)** | 일본 중심 | 化粧品 / 医薬部外品 (운영 정책에 따라) | (추후 등록) | (추후 PDF 업로드) |

> ⚠️ **아이힐(Aiheal) 정보 보강 필요**
>
> 현재 아이힐의 정확한 제품 카테고리(화장품/의약부외품), 주요 SKU, 일본 시장 진출 상태는 리드 추가 정보 필요.
> MVP 단계에서는 ‘아이힐’ 브랜드 등록만 마치고, 첫 PDF 업로드 시점에 시스템이 자동으로 카테고리를 추정·확정한다.

---

## 3. PDF 기반 학습 파이프라인

(구글 연결 제거)

### 3.1 전체 흐름

```
                  [관리자 UI]
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
  PDF 일괄 업로드            브랜드/상품 자동 매핑
  (drag & drop, 30+개)         (파일명 규칙 또는 수동)
          │                           │
          └─────────────┬─────────────┘
                        ▼
             ┌──────────────────────┐
             │  서버 측 파싱        │
             │  • pdf-parse (텍스트)│
             │  • pdf2json (구조)   │
             │  • 이미지 → 스킵    │
             └──────────┬───────────┘
                        ▼
             ┌──────────────────────┐
             │  Claude 1차 정규화   │
             │  • 필드 추출         │
             │  • 약기법 표현 라벨링│
             │  • 카테고리 추정     │
             └──────────┬───────────┘
                        ▼
             ┌──────────────────────┐
             │  DB 저장 + 임베딩    │
             │  (Postgres + pgvector│
             │   또는 Vercel KV)    │
             └──────────────────────┘
```

### 3.2 PDF 업로드 흐름 (관리자 화면)

1. 관리자가 `/admin/seed` 진입
2. 브랜드 / 상품 선택 (또는 ‘파일명에서 자동 추출’)
3. PDF 30+개 드래그 앤 드롭 (한 번에 다중 업로드)
4. Vercel Blob 또는 Supabase Storage에 저장
5. 백그라운드 작업으로 파싱·임베딩·라벨링 진행 (진행률 표시)
6. 완료 후 ‘학습 컨텍스트로 사용 가능’ 상태로 전환

### 3.3 PDF 파싱 핵심 코드

```typescript
// lib/pdf-parser.ts
import pdf from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

export async function parseAndStructurePdf(
  buffer: Buffer,
  brand: Brand,
  product: Product
) {
  // 1. 텍스트 추출
  const { text, numpages } = await pdf(buffer);

  // 2. Claude로 구조화 (오리엔트 시트 양식에 매핑)
  const client = new Anthropic({ apiKey: process.env.CLAUDE_ADMIN_KEY });
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: STRUCTURE_EXTRACTION_PROMPT,
    messages: [{
      role: 'user',
      content: `다음 오리엔트 시트 텍스트를 표준 양식으로 정규화하고
                약기법 위험 표현을 [SAFE]/[WARN]/[NG] 태그로 라벨링하라.\n\n${text}`
    }]
  });

  // 3. 결과 파싱 → DB 저장
  const structured = JSON.parse(extractJson(response.content[0].text));
  return {
    rawText: text,
    structured,
    pages: numpages,
    metadata: { brandId: brand.id, productId: product.id }
  };
}
```

### 3.4 RAG 검색 전략

새 시트 작성 시 가장 유사한 과거 PDF 사례를 자동으로 컨텍스트에 주입한다. v2.0 MVP에서는 키워드 기반, v2.5에서 임베딩 기반으로 업그레이드.

| 단계 | 방식 | 기술 | Claude에 주입할 형태 |
|---|---|---|---|
| **MVP** | 브랜드·상품 ID 매칭 | `WHERE productId = ?` | 최신 3개 PDF 요약본 직접 주입 |
| **v2.5** | 키워드 + 시즌·타겟 매칭 | PostgreSQL FTS / Meilisearch | 관련도 상위 5개 |
| **v3.0** | 시맨틱 검색 | pgvector + voyage-3 임베딩 | 벡터 유사도 기반 상위 5개 |

---

## 4. Qoo10 상품 링크 자동 처리

### 4.1 사용자 흐름

사용자가 새 시트 작성 시 Qoo10 상품 URL을 붙여넣으면 시스템이 다음을 자동 수행한다.

1. Qoo10 URL 형식 검증 (`qoo10.jp/g/<상품ID>/` 패턴)
2. 서버에서 상품 페이지 fetch 및 파싱
3. 상품명·가격·카테고리·설명·이미지 URL 추출
4. 브랜드·상품 매칭 시도 (이미 등록된 상품이면 기존 데이터 연결)
5. 미등록 상품이면 ‘신규 상품 등록 + 시트 자동 생성’ 분기
6. Claude가 파싱된 정보를 기반으로 오리엔트 시트 초안 자동 작성

### 4.2 Qoo10 파싱 전략 (3-tier 폴백)

Qoo10은 공식 외부 API가 없고 봇 차단도 빈번하다. 3단계 폴백 전략으로 안정성 확보:

| Tier | 방식 | 성공 시 동작 | 실패 시 폴백 |
|---|---|---|---|
| **1** | 서버 측 직접 fetch + Cheerio 파싱 | 자동 완성률 90%+ | 403/429 → Tier 2로 |
| **2** | Playwright(headless) + 일본 IP 프록시 | 자동 완성률 70% | 타임아웃/차단 → Tier 3으로 |
| **3** | 사용자 수동 입력 (폴백 모달) | 상품명·가격·설명을 사용자가 직접 입력 | 최소 기능 보장 |

> ⚠️ **스크래핑 법적 리스크**
>
> Qoo10 약관상 자동 스크래핑이 명시적으로 금지될 수 있음. MVP에서는 다음 원칙을 따른다:
> - 사용자가 명시적으로 ‘이 URL의 정보 가져오기’ 버튼을 누른 경우에만 1회 fetch
> - rate limit: 사용자당 분당 5건
> - User-Agent에 brifbyai 식별 정보 포함
> - robots.txt 준수
> - 결과를 DB에 캐싱해 동일 URL 재요청 방지
> - 향후 Qoo10 공식 파트너 API 사용 가능해지면 즉시 전환

### 4.3 파싱 데이터 모델

```typescript
// types/qoo10.ts
export interface Qoo10ProductData {
  url: string;
  productId: string;          // Qoo10 내부 ID
  title: string;              // 상품명 (일본어)
  titleKo?: string;           // 한국어 번역 (Claude로 추가 처리)
  price: { current: number; original?: number; currency: 'JPY' };
  category: string;           // Qoo10 카테고리
  seller: string;
  description: string;        // 상품 설명 본문
  features: string[];         // 주요 특징 bullet
  images: string[];
  reviewSummary?: {
    count: number;
    avgRating: number;
    topKeywords?: string[];   // 리뷰에서 자주 등장하는 키워드
  };
  fetchedAt: string;
  fetchMethod: 'tier1' | 'tier2' | 'tier3_manual';
}
```

### 4.4 Qoo10 URL → 시트 초안 자동 생성 흐름

```typescript
// app/api/qoo10/import/route.ts
export async function POST(req: Request) {
  const { url, brandId, apiKey } = await req.json();

  // 1. Qoo10 파싱
  const productData = await fetchQoo10Product(url);

  // 2. 카테고리 자동 분류 (Claude)
  const category = await classifyCategory(productData);
    // → 'cosmetic' / 'health_food' / etc

  // 3. 브랜드 + 유사 상품 PDF 컨텍스트 수집
  const refs = await getReferenceSheets(brandId, category);

  // 4. Claude로 시트 초안 작성 (약기법 검증 포함)
  const draftSheet = await generateSheetDraft({
    productData,
    category,
    brandContext: brandId,
    references: refs,
    targetMarket: 'jp',
    apiKey,
  });

  // 5. 시트 본문 각 문장을 약기법 3단계로 라벨링
  const validated = await validateYakkihou(draftSheet, category);

  return Response.json({ draft: validated });
}
```

---

## 5. 일본 약기법(薬機法) 자동 검증 시스템

v2.0의 가장 중요한 신규 기능. 시트 본문의 모든 문장·문구를 일본 약기법 기준으로 자동 평가하고, 3단계 위험도를 시트 내에 인라인으로 시각화한다.

### 5.1 일본 약기법(薬機法) 핵심 규제 요약

일본 약기법은 의약품, 의약부외품, 화장품, 의료기기에 대한 표현을 엄격히 규제한다. 한국 식약처보다 더 까다로우며, 위반 시 행정처분·과징금·형사처벌까지 가능하다.

| 카테고리 | 허용 표현 범위 | 금지 표현 핵심 |
|---|---|---|
| **화장품 (化粧品)** | 후생노동성이 정한 56가지 효능·효과 범위 내 | ‘치료’, ‘개선’, ‘예방’ 표현<br>시미·주름 ‘없애다’ (→ ‘눈에 띄지 않게’)<br>의약품적 효능 암시 |
| **의약부외품 (医薬部外品)** | 승인 신청 시 인정받은 효능만 | 승인 범위 초과 표현<br>치료적 효과 단정 |
| **건강식품 (健康食品)** | 영양 보급·건강 유지 수준 | ‘다이어트’, ‘지방 연소’, ‘체중 감소’<br>‘면역력 향상’, ‘치료’<br>특정 질병명 언급 |
| **기능성표시식품** | 소비자청에 신고된 기능 표시만 | 신고 범위 초과 표현<br>‘예방’, ‘치료’ |
| **일반식품** | 일반적 식품 표현만 | 모든 효능·효과 표현<br>‘건강에 좋다’도 위험 |

### 5.2 3단계 위험도 정의

| 단계 | 레벨 | 정의 및 처리 |
|:---:|:---:|---|
| 🟢 | **SAFE (안전)** | 약기법 위반 가능성이 매우 낮음. 사실 진술, 성분 표기, 영양 보급 수준의 표현.<br>예: `ビタミンC配合`, `1日1粒`, `うるおいを与える` (화장품 56가지 효능 내) |
| 🟡 | **WARN (주의)** | 맥락에 따라 위반 소지 있음. 문구 자체는 모호하나 다른 표현과 결합 시 문제 가능.<br>수정 권장 표현을 함께 제시. 운영자 검토 필요.<br>예: `ハリ感アップ`, `スッキリ`, `冴えをサポート` 등 경계선 표현 |
| 🔴 | **NG (위반)** | 명백한 약기법 위반 표현. 인플루언서 사용 시 행정 리스크 직접 발생.<br>시트에서 자동으로 빨간색 강조 + 수정 표현 자동 제안.<br>예: `痩せる`, `シミが消える`, `治る`, `予防`, `免疫力アップ` 등 |

### 5.3 검증 룰 엔진 구조

3중 레이어로 검증한다: (1) 빠른 키워드 룰 → (2) 패턴 매칭 → (3) Claude LLM 판정. 비용·속도·정확도의 균형을 위해 단계적으로 호출한다.

```typescript
// lib/yakkihou/validator.ts
export interface YakkihouFinding {
  text: string;              // 문제 표현
  startIndex: number;
  endIndex: number;
  level: 'SAFE' | 'WARN' | 'NG';
  rule: string;              // 적용된 룰 ID
  reason: string;            // 위반 이유 (일본어 + 한국어)
  suggestions: string[];     // 대체 표현 제안
  category: ProductCategory; // 어떤 카테고리 기준에서 위반
}

export async function validateYakkihou(
  sentences: string[],
  category: ProductCategory,
  apiKey: string
): Promise<YakkihouFinding[]> {
  const findings: YakkihouFinding[] = [];

  // Layer 1: 즉시 NG 키워드 (속도 우선, 비용 0)
  const ngHits = matchHardNgKeywords(sentences, category);
  findings.push(...ngHits);

  // Layer 2: 패턴 매칭 (정규식 기반 WARN 검출)
  const warnHits = matchRiskyPatterns(sentences, category);
  findings.push(...warnHits);

  // Layer 3: Claude로 맥락 판정 (NG/WARN 발견 안 된 문장만)
  const ambiguous = sentences.filter(s => !findings.find(f => f.text === s));
  const llmFindings = await classifyByClaude(ambiguous, category, apiKey);
  findings.push(...llmFindings);

  return findings;
}
```

### 5.4 룰 데이터셋 — 동아제약·아이힐 카테고리 기준

초기 룰셋은 다음 출처를 정리해 JSON으로 구축한다:

- 후생노동성 ‘화장품 표시 효능·효과 56종’ 공식 리스트
- 일본화장품공업연합회 ‘적정 광고 가이드라인’
- 소비자청 ‘건강식품 광고 가이드라인’
- 약사법 마케팅 전문 사이트 정리 (yakujihou.com, yakujihou-marketing.net 등)
- 동아제약·아이힐 사내 컴플라이언스 가이드 (별도 제공 시)

#### NG 키워드 예시 (건강식품 카테고리)

| NG 표현 (일본어) | 레벨 | 위반 사유 | 권장 대체 표현 |
|---|:---:|---|---|
| `痩せる` | 🔴 NG | 의약품적 효능 표현 | `スタイルケアをサポート` |
| `脂肪燃焼` | 🔴 NG | 신체 변화 단정 | `健やかな毎日を応援` |
| `免疫力アップ` | 🔴 NG | 의약품 효능 암시 | `毎日の健康習慣に` |
| `シミが消える` | 🔴 NG | 화장품 56가지 효능 초과 | `シミが目立ちにくい印象に` |
| `デトックス` | 🟡 WARN | 의약품적 작용 암시 우려 | `リフレッシュ感` |
| `肌がよみがえる` | 🟡 WARN | 재생 표현 과장 | `肌印象を整える` |
| `うるおいを与える` | 🟢 SAFE | 화장품 56효능 내 | (그대로 사용 가능) |
| `ビタミンC配合` | 🟢 SAFE | 성분 표기 (사실) | (그대로 사용 가능) |

위 룰셋은 `/lib/yakkihou/rules/` 디렉토리에 카테고리별 JSON으로 관리되며, 관리자 화면(`/admin/yakkihou`)에서 비개발자도 추가·수정할 수 있다.

### 5.5 시트 내 인라인 표시 UX

검증 결과는 단순히 ‘위반 있음’ 알림이 아니라, 시트 내 각 문장에 직접 색상 코드와 호버 툴팁으로 표시된다.

```
┌──────────────────────────────────────────────────────────────────┐
│  ▼ 상품 소개  [✨]                          [🛡 약기법: 1 NG, 2 WARN] │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ アイヒール美容液は、肌にうるおいを与え、🟢                   │ │
│  │ ハリ感をアップ させて、🟡                                    │ │
│  │ シミを消す効果があります。🔴 ← 호버: ‘NG: 화장품 56효능 초과’  │ │
│  │   ↳ 제안: ‘シミが目立ちにくい印象に’ [클릭으로 자동 교체]    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ▼ 콘텐츠 메시지  [✨]                                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1日1粒で🟢、健康的な毎日を応援🟢                            │ │
│  │ 脂肪を燃焼させて理想のスタイルへ🔴                          │ │
│  │   ↳ 제안: ‘スタイルケアをサポート’ [자동 교체]              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

구현은 다음 방식으로 처리:
- `contenteditable` div 또는 Tiptap/Lexical 에디터 사용
- 문장 단위로 `span` 래핑 + 위험도 클래스(`safe`/`warn`/`ng`)
- 호버 시 popover로 위반 이유 + 권장 대체 표현 + ‘자동 교체’ 버튼
- 상단 요약 배지: `🟢 12 / 🟡 3 / 🔴 1` 형태로 전체 카운트
- ‘🔴이 1개라도 있으면 내보내기 제한’ 또는 ‘경고 후 진행’ 옵션 (정책 결정 필요)

### 5.6 검증 시점

1. Claude가 시트 초안 생성 직후 (자동, 백그라운드)
2. 사용자가 텍스트 수정 시 디바운스 1초 후 자동 재검증
3. ‘내보내기’ 직전 최종 검증 (강제)

---

## 6. 오리엔트 시트 양식 (v2.0 재정의)

멀티 브랜드·Qoo10·약기법 검증을 반영해 양식을 재구성. PDF 30개 학습 후 실제 필드는 일부 조정될 수 있다.

| 그룹 | 필드명 | 타입 | Qoo10 자동 채움 | 약기법 검증 대상 |
|:---:|---|:---:|:---:|:---:|
| 기본 | 캠페인명 | text | △ | ○ |
| 기본 | 브랜드 / 상품 | select | ◎ | ✕ |
| 기본 | Qoo10 URL | url | (입력) | ✕ |
| 기본 | 적용 시장 / 약기법 카테고리 | select | ◎ | (분기 기준) |
| **상품** | **상품 소개** | rich text | ◎ | **◎ (핵심 검증)** |
| **상품** | **핵심 성분 / 효능** | tags | ◎ | **◎** |
| 상품 | 승인된 효능 표현 (의약부외품 시) | text list | △ | ○ (참조) |
| 타겟 | 타겟 오디언스 | textarea | △ | ✕ |
| 타겟 | 크리에이터 페르소나 | textarea | △ | ✕ |
| **콘텐츠** | **필수 포함 메시지** | rich list | ◎ | **◎ (핵심 검증)** |
| 콘텐츠 | 톤앤매너 / 스타일 | textarea | ◎ | ○ |
| 콘텐츠 | 금지 표현 / 주의사항 (자동) | auto | ◎ | (시스템 자동 생성) |
| **콘텐츠** | **예시 카피 (Claude 생성)** | rich list | ◎ | **◎** |
| 운영 | 업로드 채널 | multi-select | △ | ✕ |
| 운영 | 해시태그 | tags | ◎ | ○ |
| 운영 | KPI | textarea | △ | ✕ |
| 검증 | **약기법 검증 요약 (자동)** | badge | ◎ | **(시스템 출력)** |

> 범례: ◎ 자동 채움 / △ AI 추천 + 검토 / ✕ 수동 입력 / ○ 검증 대상 / **◎(검증)** 핵심 검증 대상

---

## 7. 기술 스택 (v2.0)

| 영역 | 선택 | 선택 이유 (v1.0 대비) |
|---|---|---|
| **프레임워크** | Next.js 14 (App Router) | (유지) |
| **배포** | Vercel | (유지) + Vercel Blob (PDF 저장용) |
| **AI** | Anthropic Claude API (Opus 4.7) | (유지) + 약기법 검증·PDF 구조화에 추가 사용 |
| **PDF 파싱** | pdf-parse + pdf2json | **[신규]** 구글시트 대신 PDF 학습 데이터 처리 |
| **Qoo10 파싱** | Cheerio + Playwright (폴백) | **[신규]** 3-tier 폴백 전략 |
| **약기법 검증** | 자체 룰 엔진 + Claude 판정 | **[신규]** `/lib/yakkihou` 모듈 |
| **리치 텍스트 에디터** | Tiptap | **[신규]** 인라인 약기법 하이라이트용 |
| **DB** | Vercel Postgres + Drizzle ORM | (유지) + 향후 pgvector 추가 |
| **스토리지** | Vercel Blob | **[신규]** PDF 30+개 보관용 |
| **개발 도구** | VS Code + Claude Code (CLI) | **[신규]** AI 페어 코딩, 본 PRD를 컨텍스트로 활용 |
| **UI** | shadcn/ui + Tailwind CSS | (유지) |

### 7.2 폴더 구조 (변경 부분만)

```
brifbyai/
├── app/
│   ├── (main)/
│   │   ├── new/page.tsx                 # Qoo10 URL 입력 UI 추가
│   │   ├── sheets/[id]/page.tsx         # Tiptap + 약기법 하이라이트
│   │   └── admin/
│   │       ├── seed/page.tsx            # [신규] PDF 일괄 업로드
│   │       └── yakkihou/page.tsx        # [신규] 약기법 룰 관리
│   ├── api/
│   │   ├── pdf/import/route.ts          # [신규] PDF 파싱·임베딩
│   │   ├── qoo10/import/route.ts        # [신규] Qoo10 파싱
│   │   └── yakkihou/validate/route.ts   # [신규] 약기법 검증
├── lib/
│   ├── pdf-parser.ts                    # [신규]
│   ├── qoo10/
│   │   ├── fetcher.ts                   # [신규] Tier 1~3 폴백
│   │   └── parser.ts                    # [신규] Cheerio 셀렉터
│   └── yakkihou/                        # [신규]
│       ├── validator.ts                 # 메인 검증 엔진
│       ├── rules/                       # 카테고리별 JSON 룰셋
│       │   ├── cosmetic.json
│       │   ├── health_food.json
│       │   ├── quasi_drug.json
│       │   └── general_food.json
│       ├── claude-judge.ts              # LLM 판정
│       └── suggestions.ts               # 대체 표현 생성
├── components/
│   ├── yakkihou-badge/                  # [신규] 위험도 배지
│   ├── yakkihou-tooltip/                # [신규] 호버 툴팁
│   └── pdf-uploader/                    # [신규]
└── CLAUDE.md                            # [신규] Claude Code용 컨텍스트
```

---

## 8. VS Code + Claude Code 개발 환경

개발은 VS Code 에디터 + Claude Code CLI 페어 코딩 방식으로 진행한다. 이 PRD 자체를 Claude Code의 주요 컨텍스트로 활용해 일관성 있는 개발이 가능하다.

### 8.1 초기 환경 설정

```bash
# 1. Node.js 20 LTS 설치 (필수)
node -v  # v20.x 확인

# 2. Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 3. 프로젝트 클론 + 진입
git clone https://github.com/agentcharlie7542/brifbyai.git
cd brifbyai
code .  # VS Code 실행

# 4. Claude Code 시작 (프로젝트 루트에서)
claude

# 5. 환경변수 설정
cp .env.example .env.local
# CLAUDE_ADMIN_KEY=sk-ant-...   (서버 측 PDF 파싱·검증용)
# POSTGRES_URL=...
# BLOB_READ_WRITE_TOKEN=...
# LOGIN_PASSWORD=...             (앱 게이트용)

# 6. 의존성 설치 + 개발 서버
npm install
npm run dev
```

### 8.2 CLAUDE.md (프로젝트 루트)

Claude Code는 프로젝트 루트의 `CLAUDE.md` 파일을 자동으로 컨텍스트로 읽어들인다. brifbyai의 핵심 규칙·아키텍처를 미리 적어두면 개발 효율이 크게 올라간다.

```markdown
# CLAUDE.md (예시 내용)

## 프로젝트 개요
brifbyai는 멀티 브랜드 오리엔트 시트 자동 생성 + 일본 약기법 검증 플랫폼이다.

## 코딩 규칙
- TypeScript strict 모드
- 모든 API 라우트는 try/catch + 표준 에러 응답
- 약기법 관련 코드는 /lib/yakkihou/ 하위에만 작성
- Qoo10 fetch는 반드시 3-tier 폴백 사용
- 사용자 API 키는 절대 서버 로그에 남기지 않는다

## 약기법 검증 룰
- SAFE / WARN / NG 3단계만 사용
- 모든 finding에는 reason과 suggestions 포함 필수
- 카테고리별 룰은 /lib/yakkihou/rules/*.json 참조

## 테스트
- 약기법 검증 변경 시 /tests/yakkihou/*.test.ts 반드시 실행
- Qoo10 파서 변경 시 /tests/fixtures/qoo10/*.html 로 회귀 테스트

## 참고 문서
- 본 PRD: docs/prd-v2.md
- 약기법 룰 출처: docs/yakkihou-sources.md
```

### 8.3 권장 VS Code 확장

- **ESLint + Prettier** — 코드 포맷팅
- **Tailwind CSS IntelliSense** — 자동완성
- **Drizzle ORM Snippets** — 스키마 작업
- **Error Lens** — 인라인 에러 표시
- **GitLens** — 커밋 히스토리
- **Japanese Language Pack** (선택) — 약기법 룰 작업 시

### 8.4 Claude Code 활용 시나리오

| 작업 | Claude Code 프롬프트 예시 |
|---|---|
| 새 컴포넌트 추가 | `약기법 위험도 배지 컴포넌트를 components/yakkihou-badge에 만들어줘. SAFE/WARN/NG 3단계와 카운트를 표시한다.` |
| 약기법 룰 추가 | `아이힐 화장품 카테고리에 NG 표현 10개를 추가해줘. yakujihou.com 사이트의 화장품 NG 워드 페이지 참고.` |
| Qoo10 파서 디버깅 | `tests/fixtures/qoo10/sample-1.html을 보고 parser.ts의 셀렉터가 왜 안 맞는지 분석해서 고쳐줘.` |
| DB 스키마 마이그레이션 | `Brand 테이블에 defaultMarket 컬럼을 추가하는 Drizzle 마이그레이션 만들어줘. 기존 row는 'jp'로 백필.` |
| PRD 변경 반영 | `docs/prd-v2.md의 6장 시트 양식을 보고 db/schema.ts의 Sheet 테이블 컬럼을 일치시켜줘.` |

---

## 9. 핵심 사용자 시나리오 (v2.0)

### 9.1 메인 시나리오: Qoo10 신상품 시트 5분 작성

| Step | 사용자 행동 | 시스템 반응 |
|:---:|---|---|
| 1 | brifbyai 로그인 후 ‘새 시트 만들기’ | 3가지 시작 옵션 표시: ‘Qoo10 URL로 시작’ / ‘브랜드 선택’ / ‘빈 시트’ |
| 2 | ‘Qoo10 URL로 시작’ 선택 | URL 입력 모달 표시. 예시 URL 1개 자동 첨부. |
| 3 | Qoo10 상품 URL 붙여넣기 | Tier 1 fetch (2~3초) → 상품명/가격/설명 자동 추출. 미리보기 표시. |
| 4 | 브랜드 선택 (동아제약/아이힐) | 브랜드 + 자동 분류된 카테고리(化粧品 등) 확정. ‘시트 생성’ 버튼 활성화. |
| 5 | ‘시트 생성’ 클릭 | Claude 호출 (10~20초): 학습된 PDF 컨텍스트 + Qoo10 데이터 → 시트 초안 + 약기법 라벨링 동시 생성 |
| 6 | 시트 화면 진입 | 상단 배지: `🟢 14 / 🟡 3 / 🔴 1` 표시. 빨간 문구 자동 강조. |
| 7 | 빨간 NG 문구 호버 | 툴팁: ‘NG: 의약품적 효능 표현 / 권장: `スタイルケアをサポート` [자동 교체]’ |
| 8 | ‘자동 교체’ 클릭 → NG가 SAFE로 전환 | 배지 갱신: `🟢 15 / 🟡 3 / 🔴 0` |
| 9 | 필요 시 수동 수정 → ‘내보내기’ | 최종 검증 (NG 0건 확인) → PDF/마크다운/엑셀 다운로드 |

> **총 소요 시간: 약 5분** (기존 1시간+ 대비 90%+ 단축)

### 9.2 보조 시나리오: PDF 30개로 학습 데이터 구축

1. 관리자 `/admin/seed` 진입
2. 브랜드 ‘동아제약’ 선택
3. PDF 47개 드래그 앤 드롭
4. ‘일괄 처리 시작’ → 진행률 표시 (예상 시간 10~15분)
5. 처리 완료된 PDF부터 ‘상품 매핑’ 화면으로
6. 자동 추정된 상품(화이타치온/슬림컷 등) 확인·수정 후 확정

---

## 10. 개발 로드맵 (v2.0)

| Phase | 기간 | 목표 | 주요 산출물 |
|:---:|:---:|---|---|
| **Phase 0** | Week 1 | 기반 | • 저장소·CLAUDE.md 셋업<br>• Vercel 연동·게이트<br>• Drizzle 스키마 (멀티 브랜드) |
| **Phase 1** | Week 2 | PDF 학습 | • PDF 업로더 + Vercel Blob<br>• pdf-parse + Claude 구조화<br>• 동아제약 PDF 30+개 시드 |
| **Phase 2** | Week 3 | 약기법 엔진 | • 룰 데이터셋 구축 (카테고리별)<br>• 3-layer 검증 엔진<br>• Claude 판정 통합 |
| **Phase 3** | Week 4 | 시트 UI + 검증 표시 | • Tiptap 에디터 통합<br>• 인라인 위험도 하이라이트<br>• 호버 툴팁 + 자동 교체 |
| **Phase 4** | Week 5 | Qoo10 통합 | • Tier 1 (Cheerio) 파서<br>• Tier 2 (Playwright) 폴백<br>• Tier 3 수동 입력 폴백 |
| **Phase 5** | Week 6 | E2E + 운영 | • 전체 시나리오 통합 테스트<br>• 내보내기 기능<br>• 아이힐 브랜드 온보딩<br>• QA + 첫 시연 |
| **Phase 6** | Week 7+ | v2.5 확장 | • pgvector 시맨틱 검색<br>• 약기법 룰 관리 UI<br>• 사용자별 통계<br>• 신규 브랜드 추가 |

### 10.2 MVP 정의 (Week 5 종료)

다음 시나리오가 끝까지 동작하면 MVP 완성:

1. 관리자가 동아제약 PDF 30+개 일괄 업로드 → 학습 완료
2. 사용자가 Qoo10 URL 붙여넣기 + 브랜드 선택
3. Claude가 시트 초안 생성 + 약기법 자동 라벨링
4. NG 표현 자동 교체 → 마크다운 내보내기

---

## 11. 리스크 / 미해결 이슈

| No. | 이슈 | 영향 | 대응 방안 |
|:---:|---|---|---|
| **R-01** | 약기법 룰 정확도 | 잘못된 SAFE 판정 시 법적 리스크 직접 발생 | • 초기 룰셋은 전문 사이트 출처 명시<br>• 모든 시트에 ‘최종 책임은 사용자’ 디스클레이머<br>• 운영 1개월 후 약기법 컨설팅 1회 검토 권장 |
| **R-02** | Qoo10 봇 차단 | Tier 1·2 모두 실패 시 자동화 가치 하락 | • Tier 3 (수동) 폴백 항상 보장<br>• 일본 IP 프록시 사용<br>• 5건/분 rate limit |
| **R-03** | PDF 파싱 품질 편차 | 표·이미지가 많은 PDF는 텍스트 추출 실패 가능 | • OCR 폴백 (Tesseract.js)<br>• 파싱 실패 시 관리자 알림 + 수동 보정 UI |
| **R-04** | Claude API 비용 누적 | PDF 30개 학습 + 시트마다 약기법 검증 → 비용 증가 | • 학습은 1회만, 결과 DB 캐시<br>• 룰 매칭으로 LLM 호출 최소화<br>• 사용자 API 키 사용으로 운영자 부담 0 |
| **R-05** | 아이힐 정보 부족 | 초기 학습 데이터 없음 → 시트 품질 낮음 | • MVP는 동아제약 단일로 검증<br>• 아이힐 PDF 확보 시점에 별도 온보딩<br>• 콜드 스타트 시 동아제약 패턴 일부 차용 |
| **R-06** | 약기법 외 다른 법규 | 경품표시법, 식품표시법 등 별도 규제 존재 | • v2에서는 약기법만 다룸<br>• v3에서 경품표시법 등 확장<br>• 사용자에게 명시적 안내 |

### 11.2 리드 결정 필요 사항

- 아이힐(Aiheal) 브랜드 상세 정보 — 카테고리, 주력 상품, 일본 시장 진입 상태
- 동아제약 PDF 30+개 수집 일정 — Phase 1 진입 가능한 시점
- 약기법 검증 책임 범위 — ‘참고용’ 표기로 충분한지, 전문 검수 프로세스 별도 필요한지
- ‘NG가 있어도 강제로 내보내기 가능’ 정책 — 운영자 권한으로만 가능 vs 전체 차단
- Qoo10 외 채널 (라쿠텐, 아마존 JP) 확장 시점
- 아이힐 외 추가 브랜드 — v2 일정 내에 들어올지 v3로 미룰지

---

## 12. 다음 액션

### 12.1 즉시 진행

1. 이 PRD를 `docs/prd-v2.md`로 GitHub에 커밋
2. `CLAUDE.md` 초안 작성 (8.2 참조)
3. Next.js 14 + TypeScript + Drizzle 스캐폴드 (Claude Code로 진행)
4. Vercel 프로젝트 연결 + 비밀번호 게이트 1차 배포
5. 동아제약 PDF 30+개 수집 (구글시트를 PDF로 변환)
6. 약기법 룰셋 v1 작성 (cosmetic·health_food 카테고리부터)

### 12.2 이번 주 결정

- 아이힐 정보 보강 (또는 v3로 보류 결정)
- 약기법 검증 책임 범위 정책
- MVP 첫 시연 대상자
- 도메인 정책

---

본 문서는 brifbyai v2.0 PRD입니다.
이 문서를 `docs/prd-v2.md`로 저장하고 `CLAUDE.md`에 참조 경로를 적어두면
Claude Code가 모든 개발 세션에서 자동으로 컨텍스트로 활용합니다.
