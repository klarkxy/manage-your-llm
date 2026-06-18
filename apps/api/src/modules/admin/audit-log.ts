// Admin route: list audit events. Read-only; admins use it to look at what
// happened. We don't expose raw `details` if it might carry a token (the
// redaction layer guarantees that already, but this endpoint stays narrow).

import { desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { type Db, auditEvents } from '../db/index.js';

export interface AuditRouteDeps {
  db: Db;
}

export function registerAuditRoutes(app: FastifyInstance, deps: AuditRouteDeps): void {
  const { db } = deps;
  app.get('/api/admin/audit-events', async (req) => {
    const q = (req.query ?? {}) as { limit?: string };
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? '100') || 100));
    const rows = await db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .all();
    return {
      items: rows.map((row) => ({
        id: row.id,
        actorAdminId: row.actorAdminId,
        actorUsername: row.actorUsername,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        details: row.detailsJson ? JSON.parse(row.detailsJson) : null,
        ip: row.ip,
        createdAt: row.createdAt,
      })),
    };
  });
}
