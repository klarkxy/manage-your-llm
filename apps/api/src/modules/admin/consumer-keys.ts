import { eq, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { generateId, ValidationError } from '@modelharbor/shared';
import {
  type Db,
  type ConsumerKeyRow,
  apps,
  consumerKeys,
  consumerKeyAccess,
} from '../db/index.js';
import { generateConsumerKeyRaw, resolveTarget, replaceRowsInTransaction } from './helpers.js';
import { auditMetaFromRequest } from './upstream-keys.js';
import { recordAuditEvent } from '../observability/index.js';

export interface ConsumerKeyRouteDeps {
  db: Db;
}

interface AccessInput {
  targetType?: unknown;
  targetId?: unknown;
}

function presentConsumerKey(row: ConsumerKeyRow) {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    enabled: row.enabled,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerConsumerKeyRoutes(app: FastifyInstance, deps: ConsumerKeyRouteDeps): void {
  const { db } = deps;

  app.get('/api/admin/apps/:appId/consumer-keys', async (req, reply) => {
    const { appId } = req.params as { appId: string };
    const app = await db.select().from(apps).where(eq(apps.id, appId)).get();
    if (!app) {
      reply.code(404).send({
        error: { message: 'app not found', type: 'target_not_found', code: 'target_not_found' },
      });
      return;
    }
    const rows = await db
      .select()
      .from(consumerKeys)
      .where(eq(consumerKeys.appId, appId))
      .orderBy(desc(consumerKeys.createdAt))
      .all();
    return { items: rows.map(presentConsumerKey) };
  });

  app.post('/api/admin/apps/:appId/consumer-keys', async (req, reply) => {
    const { appId } = req.params as { appId: string };
    const body = (req.body ?? {}) as { name?: unknown; access?: unknown };
    const app = await db.select().from(apps).where(eq(apps.id, appId)).get();
    if (!app) {
      reply.code(404).send({
        error: { message: 'app not found', type: 'target_not_found', code: 'target_not_found' },
      });
      return;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('name is required');

    const id = generateId('consumerKey');
    const generated = generateConsumerKeyRaw();
    const now = new Date();
    await db.insert(consumerKeys).values({
      id,
      appId,
      name,
      keyHash: generated.hash,
      keyPrefix: generated.prefix,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });

    if (Array.isArray(body.access)) {
      for (const raw of body.access) {
        const a = raw as AccessInput;
        if (typeof a.targetType !== 'string' || typeof a.targetId !== 'string') {
          throw new ValidationError('access entry requires targetType and targetId');
        }
        if (a.targetType !== 'public_model' && a.targetType !== 'model_group') {
          throw new ValidationError('targetType must be public_model or model_group');
        }
        await resolveTarget(db, a.targetType, a.targetId);
        await db.insert(consumerKeyAccess).values({
          id: generateId('consumerKey') + '_a',
          consumerKeyId: id,
          targetType: a.targetType,
          targetId: a.targetId,
          createdAt: now,
        });
      }
    }

    const row = await db.select().from(consumerKeys).where(eq(consumerKeys.id, id)).get();
    if (!row) throw new Error('insert failed');
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'consumer_key.create',
      resourceType: 'consumer_key',
      resourceId: row.id,
      details: { name: row.name, appId: row.appId, keyPrefix: row.keyPrefix },
    });
    // Raw key is returned only on create/rotate.
    return { ...presentConsumerKey(row), key: generated.raw };
  });

  app.post('/api/admin/consumer-keys/:id/revoke', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.select().from(consumerKeys).where(eq(consumerKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'consumer key not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    await db
      .update(consumerKeys)
      .set({ enabled: false, revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(consumerKeys.id, id));
    const row = await db.select().from(consumerKeys).where(eq(consumerKeys.id, id)).get();
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'consumer_key.revoke',
      resourceType: 'consumer_key',
      resourceId: id,
    });
    return presentConsumerKey(row!);
  });

  app.post('/api/admin/consumer-keys/:id/rotate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.select().from(consumerKeys).where(eq(consumerKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'consumer key not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    const generated = generateConsumerKeyRaw();
    await db
      .update(consumerKeys)
      .set({
        keyHash: generated.hash,
        keyPrefix: generated.prefix,
        enabled: true,
        revokedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(consumerKeys.id, id));
    const row = await db.select().from(consumerKeys).where(eq(consumerKeys.id, id)).get();
    if (!row) throw new Error('not found');
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'consumer_key.rotate',
      resourceType: 'consumer_key',
      resourceId: row.id,
      details: { keyPrefix: row.keyPrefix },
    });
    return { ...presentConsumerKey(row), key: generated.raw };
  });

  app.put('/api/admin/consumer-keys/:id/access', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { access?: unknown };
    const existing = await db.select().from(consumerKeys).where(eq(consumerKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'consumer key not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    if (!Array.isArray(body.access)) {
      throw new ValidationError('access must be an array');
    }
    const now = new Date();
    // Validate every entry (target exists, types match) BEFORE the transaction so a
    // bad target can't leave a half-deleted access list.
    const normalized = body.access.map((raw) => {
      const a = raw as AccessInput;
      if (typeof a.targetType !== 'string' || typeof a.targetId !== 'string') {
        throw new ValidationError('access entry requires targetType and targetId');
      }
      if (a.targetType !== 'public_model' && a.targetType !== 'model_group') {
        throw new ValidationError('targetType must be public_model or model_group');
      }
      return {
        id: generateId('consumerKey') + '_a',
        consumerKeyId: id,
        targetType: a.targetType as 'public_model' | 'model_group',
        targetId: a.targetId,
        createdAt: now,
      };
    });
    // Best-effort existence pre-check (race possible but the FK is also a backstop).
    for (const n of normalized) {
      await resolveTarget(db, n.targetType, n.targetId);
    }
    await replaceRowsInTransaction(db, {
      validate: () => undefined,
      deleteExisting: async (tx) => {
        await tx.delete(consumerKeyAccess).where(eq(consumerKeyAccess.consumerKeyId, id));
      },
      insertAll: async (tx) => {
        if (normalized.length === 0) return [];
        await tx.insert(consumerKeyAccess).values(normalized);
        return normalized;
      },
    });
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'consumer_key.access.update',
      resourceType: 'consumer_key',
      resourceId: id,
      details: { count: normalized.length },
    });
    return { access: body.access };
  });
}
