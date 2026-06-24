import { and, eq, desc, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { generateId, ValidationError } from '@modelharbor/shared';
import type { Db } from '../db/index.js';
import {
  type ModelGroupRow,
  modelGroups,
  modelGroupMembers,
  publicModels,
} from '../db/tables/models.js';
import {
  targetNames,
} from '../db/tables/routing.js';
import {
  assertTargetName,
  deleteTargetRow,
  findModelGroupById,
  replaceRowsInTransaction,
} from './helpers.js';
import { auditMetaFromRequest } from './upstream-keys.js';
import { recordAuditEvent } from '../observability/index.js';
import { isGroupBalanceMode } from '../router/group-balancer.js';
import {
  applyAutoGroupSnapshot,
  isAutoGroupPreset,
  isReferenceRegion,
  previewAutoGroupMembers,
  type AutoGroupRecommendation,
} from './model-reference.js';

export interface ModelGroupRouteDeps {
  db: Db;
}

interface MemberInput {
  publicModelId?: unknown;
  priority?: unknown;
  weight?: unknown;
  enabled?: unknown;
}

interface PresentMember {
  id: string;
  publicModelId: string;
  publicModelName: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
}

async function loadMembers(db: Db, modelGroupId: string): Promise<PresentMember[]> {
  const rows = await db
    .select({ m: modelGroupMembers, pm: publicModels })
    .from(modelGroupMembers)
    .leftJoin(publicModels, eq(modelGroupMembers.publicModelId, publicModels.id))
    .where(eq(modelGroupMembers.modelGroupId, modelGroupId))
    .all();
  return rows.map((row) => ({
    id: row.m.id,
    publicModelId: row.m.publicModelId,
    publicModelName: row.pm?.name ?? null,
    priority: row.m.priority,
    weight: row.m.weight,
    enabled: row.m.enabled,
  }));
}

function presentGroup(row: ModelGroupRow, memberCount: number) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    enabled: row.enabled,
    routingPolicy: row.routingPolicy,
    mode: row.mode,
    autoPreset: row.autoPreset,
    autoReferenceRegion: row.autoReferenceRegion,
    autoTopN: row.autoTopN,
    autoLastRefreshedAt: row.autoLastRefreshedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberCount,
  };
}

export function registerModelGroupRoutes(app: FastifyInstance, deps: ModelGroupRouteDeps): void {
  const { db } = deps;

  app.get('/api/admin/model-groups', async () => {
    const rows = await db.select().from(modelGroups).orderBy(desc(modelGroups.createdAt)).all();
    const members = await db.select().from(modelGroupMembers).all();
    const counts = new Map<string, number>();
    for (const m of members) {
      counts.set(m.modelGroupId, (counts.get(m.modelGroupId) ?? 0) + 1);
    }
    return { items: rows.map((r) => presentGroup(r, counts.get(r.id) ?? 0)) };
  });

  app.get('/api/admin/model-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await findModelGroupById(db, id);
    if (!row) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    const members = await loadMembers(db, id);
    return { ...presentGroup(row, members.length), members };
  });

  app.post('/api/admin/model-groups', async (req) => {
    const body = (req.body ?? {}) as {
      name?: unknown;
      displayName?: unknown;
      description?: unknown;
      routingPolicy?: unknown;
      members?: unknown;
      mode?: unknown;
      autoPreset?: unknown;
      autoTopN?: unknown;
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    assertTargetName(name);
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const id = generateId('modelGroup');
    const now = new Date();

    // `auto_snapshot` is data-driven: members are picked from the
    // `model_reference_entries` table using PRESET_WEIGHTS[preset]. User
    // never customises weights; `autoPreset` and `autoTopN` are the only
    // knobs. If either is missing/invalid, OR the reference table
    // contains no scored rows for the chosen preset, we silently
    // downgrade to `manual` so the admin can pick members themselves.
    const requestedMode = body.mode === 'auto_snapshot' ? 'auto_snapshot' : 'manual';
    const autoReferenceRegion = 'global' as const;
    const autoPreset = isAutoGroupPreset(body.autoPreset) ? body.autoPreset : null;
    const autoTopN =
      typeof body.autoTopN === 'number'
        ? Math.max(1, Math.min(20, Math.round(body.autoTopN)))
        : null;

    let resolvedMode: 'manual' | 'auto_snapshot' = requestedMode;
    let autoRecommendations: AutoGroupRecommendation[] = [];
    if (requestedMode === 'auto_snapshot' && autoPreset && autoTopN !== null) {
      autoRecommendations = await previewAutoGroupMembers(db, {
        region: autoReferenceRegion,
        preset: autoPreset,
        // No `weights` — preview uses PRESET_WEIGHTS[preset] directly.
        topN: autoTopN,
      });
      if (autoRecommendations.length === 0) {
        resolvedMode = 'manual';
      }
    } else if (requestedMode === 'auto_snapshot') {
      // Missing preset or topN — can't drive an auto group. Fall back
      // to manual rather than failing the request.
      resolvedMode = 'manual';
    }

    const memberInputs =
      resolvedMode === 'auto_snapshot'
        ? autoRecommendations.map((item, idx) => ({
            publicModelId: item.publicModelId,
            priority: (idx + 1) * 10,
            weight: Math.max(1, Math.round(item.score)),
            enabled: true,
          }))
        : Array.isArray(body.members)
          ? body.members
          : [];
    const normalizedMembers: Array<{
      id: string;
      modelGroupId: string;
      publicModelId: string;
      priority: number;
      weight: number;
      enabled: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    const referencedPublicModelIds = new Set<string>();
    for (const raw of memberInputs) {
      const m = raw as MemberInput;
      if (typeof m.publicModelId !== 'string') {
        throw new ValidationError('member requires publicModelId');
      }
      referencedPublicModelIds.add(m.publicModelId);
      normalizedMembers.push({
        id: generateId('modelGroup') + '_m',
        modelGroupId: id,
        publicModelId: m.publicModelId,
        priority: typeof m.priority === 'number' ? m.priority : 100,
        weight: typeof m.weight === 'number' ? m.weight : 1,
        enabled: m.enabled === false ? false : true,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (referencedPublicModelIds.size > 0) {
      const existing = await db.select({ id: publicModels.id }).from(publicModels).all();
      const known = new Set(existing.map((r) => r.id));
      for (const pmId of referencedPublicModelIds) {
        if (!known.has(pmId)) {
          throw new ValidationError(`public model not found: ${pmId}`);
        }
      }
    }

    // Single transaction: group + target_names + members. A failure rolls back
    // every insert so the namespace and the children stay consistent.
    await db.transaction(async (tx) => {
      const existingName = await tx
        .select({ id: targetNames.id })
        .from(targetNames)
        .where(sql`lower(${targetNames.name}) = lower(${name})`)
        .get();
      if (existingName) {
        throw new ValidationError(`name already in use: ${name}`);
      }
      await tx.insert(modelGroups).values({
        id,
        name,
        displayName,
        description,
        enabled: true,
        routingPolicy:
          typeof body.routingPolicy === 'string' && isGroupBalanceMode(body.routingPolicy)
            ? body.routingPolicy
            : 'priority',
        mode: resolvedMode,
        autoPreset: resolvedMode === 'auto_snapshot' ? autoPreset : null,
        autoReferenceRegion: resolvedMode === 'auto_snapshot' ? autoReferenceRegion : null,
        autoTopN: resolvedMode === 'auto_snapshot' ? autoTopN : null,
        autoLastRefreshedAt: resolvedMode === 'auto_snapshot' ? now : null,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(targetNames).values({
        id: `tn_${generateId('modelGroup').slice(-8)}`,
        name,
        targetType: 'model_group',
        targetId: id,
        createdAt: now,
      });
      if (normalizedMembers.length > 0) {
        await tx.insert(modelGroupMembers).values(normalizedMembers);
      }
    });

    const row = await findModelGroupById(db, id);
    if (!row) throw new Error('insert failed');
    const members = await loadMembers(db, id);
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.create',
      resourceType: 'model_group',
      resourceId: row.id,
      details: { name: row.name, members: members.length, mode: row.mode },
    });
    return { ...presentGroup(row, members.length), members };
  });

  app.patch('/api/admin/model-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as {
      displayName?: unknown;
      description?: unknown;
      enabled?: unknown;
      routingPolicy?: unknown;
    };
    const existing = await findModelGroupById(db, id);
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    const update: Partial<typeof modelGroups.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.displayName === 'string' || body.displayName === null) {
      update.displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;
    }
    if (typeof body.description === 'string' || body.description === null) {
      update.description = typeof body.description === 'string' ? body.description.trim() : null;
    }
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (typeof body.routingPolicy === 'string') {
      if (!isGroupBalanceMode(body.routingPolicy)) {
        throw new ValidationError(`invalid routingPolicy: ${body.routingPolicy}`);
      }
      update.routingPolicy = body.routingPolicy;
    }
    await db.update(modelGroups).set(update).where(eq(modelGroups.id, id));
    const row = await findModelGroupById(db, id);
    if (!row) throw new Error('not found');
    const members = await loadMembers(db, id);
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.update',
      resourceType: 'model_group',
      resourceId: row.id,
      details: { name: row.name, enabled: row.enabled },
    });
    return { ...presentGroup(row, members.length), members };
  });

  app.put('/api/admin/model-groups/:id/members', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { members?: unknown };
    const existing = await findModelGroupById(db, id);
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    if (!Array.isArray(body.members)) {
      throw new ValidationError('members must be an array');
    }
    const now = new Date();
    const normalized = body.members.map((raw) => {
      const m = raw as MemberInput;
      if (typeof m.publicModelId !== 'string') {
        throw new ValidationError('member requires publicModelId');
      }
      return {
        id: generateId('modelGroup') + '_m',
        modelGroupId: id,
        publicModelId: m.publicModelId,
        priority: typeof m.priority === 'number' ? m.priority : 100,
        weight: typeof m.weight === 'number' ? m.weight : 1,
        enabled: m.enabled === false ? false : true,
        createdAt: now,
        updatedAt: now,
      };
    });
    await replaceRowsInTransaction(db, {
      validate: () => undefined,
      deleteExisting: async (tx) => {
        await tx.delete(modelGroupMembers).where(eq(modelGroupMembers.modelGroupId, id));
      },
      insertAll: async (tx) => {
        if (normalized.length === 0) return [];
        await tx.insert(modelGroupMembers).values(normalized);
        return normalized;
      },
    });
    await db
      .update(modelGroups)
      .set({
        mode: 'manual',
        autoPreset: null,
        autoReferenceRegion: null,
        autoTopN: null,
        autoLastRefreshedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(modelGroups.id, id));
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.update',
      resourceType: 'model_group',
      resourceId: id,
      details: { membersCount: normalized.length },
    });
    const members = await loadMembers(db, id);
    return { members };
  });

  // PATCH a single member's `enabled` flag. Used by the dashboard to
  // soft-delete an individual public model from an auto-snapshot group
  // without losing the group's auto config (which `PUT .../members`
  // would do by flipping the mode to `manual`).
  app.patch('/api/admin/model-groups/:id/members/:memberId', async (req, reply) => {
    const { id, memberId } = req.params as { id: string; memberId: string };
    const body = (req.body ?? {}) as { enabled?: unknown };
    if (typeof body.enabled !== 'boolean') {
      reply.code(400).send({
        error: {
          message: 'enabled must be a boolean',
          type: 'validation_error',
          code: 'invalid_enabled',
        },
      });
      return;
    }
    const existing = await findModelGroupById(db, id);
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    const updated = await db
      .update(modelGroupMembers)
      .set({ enabled: body.enabled, updatedAt: new Date() })
      .where(
        // Both the modelGroupId and the memberId must match — never
        // allow a caller to flip a member belonging to a different
        // group by guessing the member id alone.
        and(eq(modelGroupMembers.modelGroupId, id), eq(modelGroupMembers.id, memberId)),
      )
      .returning({ id: modelGroupMembers.id })
      .get();
    if (!updated) {
      reply.code(404).send({
        error: {
          message: 'member not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    await db
      .update(modelGroups)
      .set({ updatedAt: new Date() })
      .where(eq(modelGroups.id, id));
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.update',
      resourceType: 'model_group',
      resourceId: id,
      details: { memberToggled: true, memberId, enabled: body.enabled },
    });
    const members = await loadMembers(db, id);
    return { members };
  });

  app.post('/api/admin/model-groups/:id/refresh-auto', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await findModelGroupById(db, id);
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    if (existing.mode !== 'auto_snapshot') {
      throw new ValidationError('model group is not an auto snapshot group');
    }
    const preset = isAutoGroupPreset(existing.autoPreset) ? existing.autoPreset : 'balanced';
    const region = isReferenceRegion(existing.autoReferenceRegion) ? existing.autoReferenceRegion : 'global';
    const topN = existing.autoTopN ?? 5;
    const result = await applyAutoGroupSnapshot(db, {
      modelGroupId: id,
      region,
      preset,
      // No weights — applyAutoGroupSnapshot uses PRESET_WEIGHTS[preset].
      topN,
    });
    const now = new Date();
    await db
      .update(modelGroups)
      .set({ autoLastRefreshedAt: now, updatedAt: now })
      .where(eq(modelGroups.id, id));
    const row = await findModelGroupById(db, id);
    if (!row) throw new Error('not found');
    const members = await loadMembers(db, id);
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.update',
      resourceType: 'model_group',
      resourceId: id,
      details: { refreshedAutoSnapshot: true, membersCount: members.length },
    });
    return { ...presentGroup(row, members.length), members, recommendations: result.recommendations };
  });

  app.post('/api/admin/model-groups/:id/load-more-auto', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await findModelGroupById(db, id);
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    if (existing.mode !== 'auto_snapshot') {
      throw new ValidationError('model group is not an auto snapshot group');
    }
    const preset = isAutoGroupPreset(existing.autoPreset) ? existing.autoPreset : 'balanced';
    const region = isReferenceRegion(existing.autoReferenceRegion)
      ? existing.autoReferenceRegion
      : 'global';

    // We ask preview for `current + 5` and skip everything that's
    // already a member (enabled or disabled). This is more robust than
    // fetching exactly the next 5 by score, because the underlying
    // scoring can shift between refreshes.
    const existingMembers = await loadMembers(db, id);
    const excludeIds = existingMembers.map((m) => m.publicModelId);
    const requestedTopN = excludeIds.length + 5;
    const recommendations = await previewAutoGroupMembers(db, {
      region,
      preset,
      topN: requestedTopN,
      excludePublicModelIds: excludeIds,
    });
    const added = recommendations.slice(0, 5);
    if (added.length === 0) {
      return {
        added: 0,
        recommendations: [],
        members: existingMembers,
      };
    }

    // Priority: keep the existing `priority` order stable, append the
    // new batch after the last existing slot with a +10 step. Weight:
    // use the rounded score like the create/refresh paths do.
    const maxPriority = existingMembers.reduce((m, member) => Math.max(m, member.priority), 0);
    const now = new Date();
    const newRows = added.map((item, idx) => ({
      id: generateId('modelGroup') + '_m',
      modelGroupId: id,
      publicModelId: item.publicModelId,
      enabled: true,
      priority: maxPriority + (idx + 1) * 10,
      weight: Math.max(1, Math.round(item.score)),
      createdAt: now,
      updatedAt: now,
    }));
    await db.insert(modelGroupMembers).values(newRows);
    const members = await loadMembers(db, id);
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.update',
      resourceType: 'model_group',
      resourceId: id,
      details: { loadMoreAuto: true, added: newRows.length, membersCount: members.length },
    });
    return {
      added: newRows.length,
      recommendations: added,
      members,
    };
  });

  app.delete('/api/admin/model-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await findModelGroupById(db, id);
    if (!existing) {
      reply.code(404).send({
        error: {
          message: 'model group not found',
          type: 'target_not_found',
          code: 'target_not_found',
        },
      });
      return;
    }
    await deleteTargetRow(db, {
      targetType: 'model_group',
      targetId: id,
      deleteTarget: async (tx) => {
        await tx.delete(modelGroups).where(eq(modelGroups.id, id));
      },
    });
    await recordAuditEvent(db, {
      ...auditMetaFromRequest(req),
      action: 'model_group.delete',
      resourceType: 'model_group',
      resourceId: id,
    });
    return { id, deleted: true };
  });
}
