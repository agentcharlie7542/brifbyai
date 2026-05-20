/**
 * Local file-system storage for Phase 1 development.
 *
 * Persistence layout under ./uploads/:
 *   uploads/
 *     brands.json                    [BrandRecord, ...]
 *     reference-sheets/
 *       index.json                   [ReferenceSheetRecord, ...]
 *       <uuid>.pdf                   raw PDF bytes
 *       <uuid>.json                  full parsed + structured payload
 *
 * Phase 5+ replaces this with Vercel Blob (PDF bytes) + Vercel Postgres
 * (metadata). The function signatures here are intentionally close to what a
 * future repository layer would expose so the swap is mechanical.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import type { ProductCategory } from '@/lib/yakkihou/types';

const ROOT = path.join(process.cwd(), 'uploads');
const BRANDS_FILE = path.join(ROOT, 'brands.json');
const REF_DIR = path.join(ROOT, 'reference-sheets');
const REF_INDEX = path.join(REF_DIR, 'index.json');

export type TargetMarket = 'jp' | 'kr' | 'global';

export interface BrandRecord {
  id: string;
  name: string;
  nameJa?: string;
  defaultMarket: TargetMarket;
  defaultTone?: string;
  createdAt: string;
}

export interface ReferenceSheetRecord {
  id: string;
  brandId: string;
  productId?: string;
  fileName: string;
  storagePath: string; // relative path inside uploads/
  pages?: number;
  category?: ProductCategory;
  uploadedAt: string;
  status: 'parsing' | 'ready' | 'failed';
  error?: string;
}

export interface ReferenceSheetPayload extends ReferenceSheetRecord {
  parsedText: string;
  structured: unknown;
  meta?: Record<string, unknown>;
}

async function ensureDirs() {
  await fs.mkdir(REF_DIR, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- Brands ---------------------------------------------------------------

export async function listBrands(): Promise<BrandRecord[]> {
  await ensureDirs();
  return readJson<BrandRecord[]>(BRANDS_FILE, []);
}

export async function getBrand(id: string): Promise<BrandRecord | null> {
  const brands = await listBrands();
  return brands.find((b) => b.id === id) ?? null;
}

export async function ensureSeedBrands(): Promise<BrandRecord[]> {
  await ensureDirs();
  const current = await listBrands();
  if (current.length > 0) return current;

  const seeded: BrandRecord[] = [
    {
      id: randomUUID(),
      name: '동아제약',
      nameJa: '東亜製薬',
      defaultMarket: 'jp',
      createdAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      name: '아이힐',
      nameJa: 'アイヒール',
      defaultMarket: 'jp',
      createdAt: new Date().toISOString(),
    },
  ];
  await writeJson(BRANDS_FILE, seeded);
  return seeded;
}

// --- Reference sheets ----------------------------------------------------

export async function listReferenceSheets(): Promise<ReferenceSheetRecord[]> {
  await ensureDirs();
  return readJson<ReferenceSheetRecord[]>(REF_INDEX, []);
}

export async function listReferenceSheetsByBrand(
  brandId: string
): Promise<ReferenceSheetRecord[]> {
  const all = await listReferenceSheets();
  return all.filter((r) => r.brandId === brandId);
}

export async function getReferenceSheet(
  id: string
): Promise<ReferenceSheetPayload | null> {
  const filePath = path.join(REF_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as ReferenceSheetPayload;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveReferenceSheet(args: {
  brandId: string;
  fileName: string;
  pdfBytes: Buffer;
  parsedText: string;
  structured: unknown;
  pages?: number;
  category?: ProductCategory;
  meta?: Record<string, unknown>;
}): Promise<ReferenceSheetPayload> {
  await ensureDirs();
  const id = randomUUID();
  const pdfPath = path.join(REF_DIR, `${id}.pdf`);
  const jsonPath = path.join(REF_DIR, `${id}.json`);

  await fs.writeFile(pdfPath, args.pdfBytes);

  const record: ReferenceSheetRecord = {
    id,
    brandId: args.brandId,
    fileName: args.fileName,
    storagePath: path.relative(ROOT, pdfPath),
    pages: args.pages,
    category: args.category,
    uploadedAt: new Date().toISOString(),
    status: 'ready',
  };
  const payload: ReferenceSheetPayload = {
    ...record,
    parsedText: args.parsedText,
    structured: args.structured,
    meta: args.meta,
  };
  await writeJson(jsonPath, payload);

  const index = await listReferenceSheets();
  index.unshift(record);
  await writeJson(REF_INDEX, index);

  return payload;
}
