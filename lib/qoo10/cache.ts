/**
 * Qoo10 fetch 결과 로컬 캐시.
 *
 * uploads/qoo10/<productId>.json 에 ProductData 저장.
 * 동일 URL 재요청은 캐시에서 반환 (Qoo10 부담 + Claude 분류 비용 0).
 * TTL 은 일단 무한 — 캐시 무효화는 수동.
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { Qoo10ProductData } from './types';

const DIR = path.join(process.cwd(), 'uploads', 'qoo10');

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

export async function getCached(
  productId: string
): Promise<Qoo10ProductData | null> {
  const f = path.join(DIR, `${productId}.json`);
  try {
    const raw = await fs.readFile(f, 'utf8');
    return JSON.parse(raw) as Qoo10ProductData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveCached(data: Qoo10ProductData): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DIR, `${data.productId}.json`),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}
