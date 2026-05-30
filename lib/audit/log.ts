/**
 * 행동(감사) 로그 기록.
 *
 * 로그 실패가 본 기능(시트 생성 등)을 막아선 안 되므로 best-effort — 예외는 삼킨다.
 */
import { db, schema } from '@/db';
import type { NewAuditLog } from '@/db/schema';

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'upload_pdf'
  | 'delete_reference_sheet'
  | 'qoo10_import'
  | 'generate_sheet'
  | 'update_sheet'
  | 'delete_sheet'
  | 'create_brand'
  | 'update_brand'
  | 'create_user'
  | 'update_user';

export interface LogActionInput {
  userId?: string | null;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string;
  brandId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function logAction(input: LogActionInput): Promise<void> {
  try {
    const row: NewAuditLog = {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      brandId: input.brandId,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    };
    await db.insert(schema.auditLogs).values(row);
  } catch (err) {
    console.warn('[audit] log failed:', (err as Error).message);
  }
}

/** Request 헤더에서 IP·User-Agent 추출 (Vercel 프록시 헤더 고려). */
export function requestMeta(req: Request): { ip?: string; userAgent?: string } {
  const userAgent = req.headers.get('user-agent') ?? undefined;
  const fwd = req.headers.get('x-forwarded-for');
  const ip =
    fwd?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;
  return { ip, userAgent };
}
