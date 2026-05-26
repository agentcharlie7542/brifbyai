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
