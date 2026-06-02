/**
 * Qoo10 fetch 결과 로컬 캐시.
 *
 * Vercel 서버리스의 작업 디렉터리(process.cwd())는 읽기 전용이라
 * 반드시 os.tmpdir() 하위(쓰기 가능)에 저장한다. /tmp 는 lambda 인스턴스
 * 단위로 유지되어 hot 호출에선 캐시 hit, cold 호출에선 미스 — 그 정도면
 * Qoo10 부담 완화 목적엔 충분.
 *
 * 캐시 I/O 실패는 import 흐름을 막지 않는다(best-effort).
 */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { Qoo10ProductData } from './types';

const DIR = path.join(os.tmpdir(), 'qoo10-cache');

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
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EACCES' || code === 'EROFS') return null;
    console.warn('[qoo10 cache] read failed:', (err as Error).message);
    return null;
  }
}

export async function deleteCached(productId: string): Promise<void> {
  try {
    await fs.unlink(path.join(DIR, `${productId}.json`));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return;
    console.warn('[qoo10 cache] delete failed:', (err as Error).message);
  }
}

export async function saveCached(data: Qoo10ProductData): Promise<void> {
  try {
    await ensureDir();
    await fs.writeFile(
      path.join(DIR, `${data.productId}.json`),
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('[qoo10 cache] save failed:', (err as Error).message);
  }
}
