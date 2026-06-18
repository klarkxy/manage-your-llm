import { eq, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { generateId, ValidationError } from '@modelharbor/shared';
import { type Db, type AppRow, apps } from '../db/index.js';
import { auditMetaFromRequest } from './upstream-keys.js';
import { recordAuditEvent } from '../observability/index.js';

export interface AppRouteDeps {
  db: Db;
}

function presentApp(row: AppRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerAppRoutes(app: FastifyInstance, deps: AppRouteDeps): void {
  const { db } = deps;

  app.get('/api/admin/apps', async () => {
    const rows = await db.select().from(apps).orderBy(desc(apps.createdAt)).all();
    return { items: rows.map(presentApp) };
  });

  app.get('/api/admin/apps/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.select().from(apps).where(eq(apps.id, id)).get();
    if (!row) {
      reply.code(404).send({
        error: { message: 'app not found', type: 'target_not_found', code: 'target_not_found' },
      });
      return;
    }
    return presentApp(row);
  });

  app.post('/api/admin/apps', async (req, reply) => {
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('name is required');
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const existing = await db.select().from(apps).where(eq(apps.name, name)).get();
    if (existing) {
      reply.code(409).send({
        error: {
          message: 'app name already in use',
          type: 'validation_error',
          code: 'validation_error',
        },
      });
      return;
    }
    const id = generateId('app');
    const now = new Date();
    await db
      .insert(apps)
      .values({ id, name, description, enabled: true, createdAt: now, updatedAt: now });
    const row = await db.select().from(apps).where(eq(apps.id, id)).get();
    if (!row) throw new Error('insert failed');
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'app.create',
      resourceType: 'app',
      resourceId: row.id,
      details: { name: row.name },
    });
    return presentApp(row);
  });

  app.patch('/api/admin/apps/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown; enabled?: unknown };
    const existing = await db.select().from(apps).where(eq(apps.id, id)).get();
    if (!existing) {
      reply.code(404).send({
        error: { message: 'app not found', type: 'target_not_found', code: 'target_not_found' },
      });
      return;
    }
    const update: Partial<typeof apps.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.name === 'string' && body.name.trim() !== existing.name) {
      const dup = await db.select().from(apps).where(eq(apps.name, body.name.trim())).get();
      if (dup) {
        reply.code(409).send({
          error: {
            message: 'app name already in use',
            type: 'validation_error',
            code: 'validation_error',
          },
        });
        return;
      }
      update.name = body.name.trim();
    }
    if (typeof body.description === 'string' || body.description === null) {
      update.description = typeof body.description === 'string' ? body.description.trim() : null;
    }
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    await db.update(apps).set(update).where(eq(apps.id, id));
    const row = await db.select().from(apps).where(eq(apps.id, id)).get();
    if (!row) throw new Error('not found');
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'app.update',
      resourceType: 'app',
      resourceId: row.id,
      details: { name: row.name, enabled: row.enabled },
    });
    return presentApp(row);
  });
}
