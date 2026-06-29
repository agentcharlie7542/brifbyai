import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';

export const productCategoryEnum = pgEnum('product_category', [
  'cosmetic',
  'quasi_drug',
  'health_food',
  'functional_food',
  'general_food',
  'medical_device',
  'general',
]);

export const targetMarketEnum = pgEnum('target_market', ['jp', 'kr', 'global']);

export const yakkihouLevelEnum = pgEnum('yakkihou_level', [
  'SAFE',
  'WARN',
  'NG',
]);

export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'viewer']);

export const socialPlatformEnum = pgEnum('social_platform', [
  'youtube',
  'instagram',
  'tiktok',
]);

// ──────────────────────────────────────────────────────────────────────────
// Trend KeyWord 매칭 (Language Packaging Engine) enums
// ──────────────────────────────────────────────────────────────────────────

/** 매칭유형: A=한자직수용 B=음차외래어 C=의미현지화 D=시장재정의 X=직역(사용지양) */
export const matchTypeEnum = pgEnum('match_type', ['A', 'B', 'C', 'D', 'X']);

export const scriptTypeEnum = pgEnum('script_type', [
  'KANJI',
  'KATAKANA',
  'HIRAGANA',
  'MIXED',
  'ROMAN',
  'UNKNOWN',
]);

export const exposureLevelEnum = pgEnum('exposure_level', [
  'HIGH',
  'MID',
  'LOW',
]);

export const aversionLevelEnum = pgEnum('aversion_level', [
  'LOW',
  'MID',
  'HIGH',
]);

/** 약기법 리스크. 기존 yakkihou_level(SAFE/WARN/NG)과 별개 개념 */
export const yakkihouRiskEnum = pgEnum('yakkihou_risk', [
  'SAFE',
  'CAUTION',
  'PROHIBITED',
]);

export const igCountStatusEnum = pgEnum('ig_count_status', [
  'VERIFIED',
  'ESTIMATED',
]);

export const trendVerificationStatusEnum = pgEnum('trend_verification_status', [
  'PENDING',
  'VERIFIED',
  'REJECTED',
]);

export const usageContextEnum = pgEnum('usage_context', [
  'TITLE',
  'TAG',
  'BODY',
  'AD',
]);

export const brandTermTypeEnum = pgEnum('brand_term_type', [
  'OWNED',
  'COMPETITOR',
]);

export const trendTermStatusEnum = pgEnum('trend_term_status', [
  'ACTIVE',
  'DEPRECATED',
]);

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  nameJa: varchar('name_ja', { length: 128 }),
  logoUrl: text('logo_url'),
  defaultMarket: targetMarketEnum('default_market').notNull().default('jp'),
  defaultTone: text('default_tone'),
  brandGuideUrl: text('brand_guide_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  nameJa: varchar('name_ja', { length: 256 }),
  category: productCategoryEnum('category').notNull(),
  targetMarket: targetMarketEnum('target_market').notNull().default('jp'),
  qoo10Url: text('qoo10_url'),
  qoo10Data: jsonb('qoo10_data').$type<Record<string, unknown>>(),
  approvedClaims: jsonb('approved_claims').$type<string[]>(),
  keyIngredients: jsonb('key_ingredients').$type<string[]>(),
  targetAudience: text('target_audience'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const referenceSheets = pgTable('reference_sheets', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  fileName: varchar('file_name', { length: 256 }).notNull(),
  storageUrl: text('storage_url').notNull(),
  parsedText: text('parsed_text'),
  structured: jsonb('structured').$type<Record<string, unknown>>(),
  pages: integer('pages'),
  uploadedById: uuid('uploaded_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const sheets = pgTable('sheets', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  campaignName: varchar('campaign_name', { length: 256 }).notNull(),
  targetMarket: targetMarketEnum('target_market').notNull().default('jp'),
  category: productCategoryEnum('category').notNull(),
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  yakkihouSummary: jsonb('yakkihou_summary').$type<{
    safe: number;
    warn: number;
    ng: number;
    /** NG/WARN finding 디테일 (본문 옆 인라인 배지용). SAFE 은 제외. */
    findings?: Array<{
      text: string;
      level: 'WARN' | 'NG';
      rule: string;
      reason: string;
      suggestions: string[];
    }>;
  }>(),
  createdBy: varchar('created_by', { length: 128 }),
  createdById: uuid('created_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  updatedById: uuid('updated_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const yakkihouFindings = pgTable('yakkihou_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sheetId: uuid('sheet_id')
    .notNull()
    .references(() => sheets.id, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(),
  text: text('text').notNull(),
  startIndex: integer('start_index').notNull(),
  endIndex: integer('end_index').notNull(),
  level: yakkihouLevelEnum('level').notNull(),
  rule: varchar('rule', { length: 64 }).notNull(),
  reason: text('reason').notNull(),
  suggestions: jsonb('suggestions').$type<string[]>(),
  category: productCategoryEnum('category').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  name: varchar('name', { length: 128 }),
  role: userRoleEnum('role').notNull().default('editor'),
  /** scrypt 해시 (salt:hash hex). 외부 IdP 연동 시 null 가능. */
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  /** 행동 유형: login, logout, upload_pdf, create_sheet, update_sheet, delete_sheet, generate_sheet, qoo10_import 등 */
  action: varchar('action', { length: 64 }).notNull(),
  /** 대상 종류: sheet, reference_sheet, brand, user 등 (옵션) */
  entityType: varchar('entity_type', { length: 64 }),
  entityId: uuid('entity_id'),
  brandId: uuid('brand_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ip: varchar('ip', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const influencers = pgTable('influencers', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  platform: socialPlatformEnum('platform').notNull(),
  handle: varchar('handle', { length: 128 }).notNull(),
  displayName: varchar('display_name', { length: 256 }),
  url: text('url'),
  followerCount: integer('follower_count'),
  /** 원본/수집 데이터: bio, 최근 게시물(캡션·태그·지표) 등 */
  profile: jsonb('profile').$type<Record<string, unknown>>(),
  /** Claude 가 추출한 페르소나: tone, topics[], audience, strengths, summary */
  persona: jsonb('persona').$type<Record<string, unknown>>(),
  createdById: uuid('created_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const influencerProposals = pgTable('influencer_proposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  sheetId: uuid('sheet_id')
    .notNull()
    .references(() => sheets.id, { onDelete: 'cascade' }),
  influencerId: uuid('influencer_id')
    .notNull()
    .references(() => influencers.id, { onDelete: 'cascade' }),
  /** 인플루언서 보이스로 재구성한 제안 (StructuredOrientSheet 확장 형태) */
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  yakkihouSummary: jsonb('yakkihou_summary').$type<{
    safe: number;
    warn: number;
    ng: number;
    findings?: Array<{
      text: string;
      level: 'WARN' | 'NG';
      rule: string;
      reason: string;
      suggestions: string[];
    }>;
  }>(),
  status: varchar('status', { length: 32 }).notNull().default('draft'),
  createdById: uuid('created_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ──────────────────────────────────────────────────────────────────────────
// Trend KeyWord 매칭 (Language Packaging Engine)
// 한국 트렌드 워드 → 일본 현지 매칭어. 초기 DB 는 scripts/seed-trend-words.mjs 로 시드.
// ──────────────────────────────────────────────────────────────────────────

export const krTrendTerms = pgTable('kr_trend_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** 한국어 트렌드 워드 (예: 물광피부) */
  krTerm: varchar('kr_term', { length: 128 }).notNull(),
  /** 대분류 (카테고리의 '/' 앞, 예: 스킨케어) */
  category: varchar('category', { length: 64 }),
  /** 세부분류 (카테고리의 '/' 뒤, 예: 광택) */
  subCategory: varchar('sub_category', { length: 64 }),
  /** 동의어 그룹 키 (MVP = 정규화된 krTerm) */
  synonymGroup: varchar('synonym_group', { length: 128 }),
  /** 한국 시장 트렌드 강도 (현재 CSV 미제공 → null) */
  trendScore: integer('trend_score'),
  /** 최초 관측 채널 */
  sourceChannel: varchar('source_channel', { length: 64 }),
  status: trendTermStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const jpMatchedTerms = pgTable('jp_matched_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  krTermId: uuid('kr_term_id')
    .notNull()
    .references(() => krTrendTerms.id, { onDelete: 'cascade' }),
  /** 언어 코드 (다국어 확장 대비, 기본 'ja') */
  langCode: varchar('lang_code', { length: 8 }).notNull().default('ja'),
  /** 일본어 매칭어 ★추천 (예: 水光肌) */
  jpTerm: varchar('jp_term', { length: 128 }).notNull(),
  /** 읽기 (예: すいこうはだ) */
  jpReading: varchar('jp_reading', { length: 128 }),
  /** 직역(기준선) — 비교용. 예: 蜂蜜光肌 */
  literalBaseline: varchar('literal_baseline', { length: 128 }),
  scriptType: scriptTypeEnum('script_type'),
  matchType: matchTypeEnum('match_type'),
  /** 후보 우선순위 (1=최우선). 사용자가 등록하는 1·2순위가 여기 저장 */
  priorityRank: integer('priority_rank').notNull().default(9),
  usageContext: usageContextEnum('usage_context'),
  /** IG 해시태그 인용 수 */
  igHashtagCount: integer('ig_hashtag_count'),
  /** 해시태그 수의 신뢰도 (실측 VERIFIED / 추정 ESTIMATED) */
  igCountStatus: igCountStatusEnum('ig_count_status')
    .notNull()
    .default('ESTIMATED'),
  exposureLevel: exposureLevelEnum('exposure_level'),
  aversionLevel: aversionLevelEnum('aversion_level'),
  /** 검색량 지표 (현재 CSV 미제공 → null) */
  jpSearchVolume: integer('jp_search_volume'),
  platform: varchar('platform', { length: 32 }),
  /** 종합 신뢰도 (추후 산출 → null) */
  confidenceScore: integer('confidence_score'),
  yakkihouRisk: yakkihouRiskEnum('yakkihou_risk'),
  yakkihouNote: text('yakkihou_note'),
  nuanceNote: text('nuance_note'),
  /** 채택 브랜드 예시 */
  brandAdoption: jsonb('brand_adoption').$type<string[]>(),
  /** 연관 추천 키워드 */
  relatedKeywords: jsonb('related_keywords').$type<string[]>(),
  /** 출처: SEED(초기사전) | LLM(Claude 제안) | USER(사용자 등록) */
  source: varchar('source', { length: 16 }).notNull().default('SEED'),
  verificationStatus: trendVerificationStatusEnum('verification_status')
    .notNull()
    .default('PENDING'),
  verifiedBy: varchar('verified_by', { length: 128 }),
  verifiedDate: timestamp('verified_date', { withTimezone: true }),
  // NOTE: 의미 매칭용 embedding VECTOR 컬럼은 Phase 2.5 확장점 (pgvector 미설치).
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const brandTermConventions = pgTable('brand_term_conventions', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** 브랜드명 (' ★자사' 표기 제거) */
  brand: varchar('brand', { length: 64 }).notNull(),
  /** 자사(OWNED) / 경쟁사(COMPETITOR) */
  brandType: brandTermTypeEnum('brand_type').notNull(),
  /** 유형 원문 (예: JP진출 K뷰티, 펨케어/이너) */
  categoryHint: varchar('category_hint', { length: 64 }),
  styleNote: text('style_note'),
  /** 대표 채택어 */
  adoptedTerms: jsonb('adopted_terms').$type<string[]>(),
  /** 회피·주의 표현 */
  avoidTerms: text('avoid_terms'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Influencer = typeof influencers.$inferSelect;
export type NewInfluencer = typeof influencers.$inferInsert;
export type InfluencerProposal = typeof influencerProposals.$inferSelect;
export type NewInfluencerProposal = typeof influencerProposals.$inferInsert;

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ReferenceSheet = typeof referenceSheets.$inferSelect;
export type NewReferenceSheet = typeof referenceSheets.$inferInsert;
export type Sheet = typeof sheets.$inferSelect;
export type NewSheet = typeof sheets.$inferInsert;
export type YakkihouFinding = typeof yakkihouFindings.$inferSelect;
export type NewYakkihouFinding = typeof yakkihouFindings.$inferInsert;

export type KrTrendTerm = typeof krTrendTerms.$inferSelect;
export type NewKrTrendTerm = typeof krTrendTerms.$inferInsert;
export type JpMatchedTerm = typeof jpMatchedTerms.$inferSelect;
export type NewJpMatchedTerm = typeof jpMatchedTerms.$inferInsert;
export type BrandTermConvention = typeof brandTermConventions.$inferSelect;
export type NewBrandTermConvention = typeof brandTermConventions.$inferInsert;
