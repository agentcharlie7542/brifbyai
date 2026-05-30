import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  brandId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
}

export async function listAuditLogs(
  opts: { limit?: number; action?: string; userId?: string } = {}
): Promise<AuditLogRow[]> {
  const conds = [];
  if (opts.action) conds.push(eq(schema.auditLogs.action, opts.action));
  if (opts.userId) conds.push(eq(schema.auditLogs.userId, opts.userId));

  return db
    .select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      entityType: schema.auditLogs.entityType,
      entityId: schema.auditLogs.entityId,
      brandId: schema.auditLogs.brandId,
      metadata: schema.auditLogs.metadata,
      ip: schema.auditLogs.ip,
      createdAt: schema.auditLogs.createdAt,
      userEmail: schema.users.email,
      userName: schema.users.name,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(opts.limit ?? 200);
}
