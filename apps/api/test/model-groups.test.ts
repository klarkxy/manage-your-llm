import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { modelGroups } from '../src/modules/db/tables/models.js';
import { modelReferenceEntries, publicModels } from '../src/modules/db/tables/models.js';
import { targetNames } from '../src/modules/db/tables/routing.js';
import { generateId } from '@modelharbor/shared';
import { makeAdminRig, seedFullRoute, type AdminTestRig } from './helper.js';

describe('model groups admin', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('rolls back the whole create when a member points at a missing public model', async () => {
    await seedFullRoute(rig);
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'mg-rollback',
        members: [{ publicModelId: 'publicModel_does-not-exist', priority: 10 }],
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    // The group row and its target_names row should be gone.
    const mg = await rig.db
      .select()
      .from(modelGroups)
      .where(eq(modelGroups.name, 'mg-rollback'))
      .get();
    expect(mg).toBeUndefined();
    const tn = await rig.db
      .select()
      .from(targetNames)
      .where(eq(targetNames.name, 'mg-rollback'))
      .get();
    expect(tn).toBeUndefined();
    // Name must be reusable after the failure.
    const retry = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: { name: 'mg-rollback' },
    });
    expect(retry.statusCode).toBe(200);
  });

  it('creates a group with a valid routing policy and rejects invalid ones', async () => {
    await seedFullRoute(rig);
    const createRes = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: { name: 'mg-policy', routingPolicy: 'round_robin' },
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { routingPolicy: string };
    expect(created.routingPolicy).toBe('round_robin');

    const invalidRes = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/model-groups/${(created as { id: string }).id}`,
      headers: { cookie: rig.cookie },
      payload: { routingPolicy: 'bad-mode' },
    });
    expect(invalidRes.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('lists, gets, refreshes, and deletes model groups', async () => {
    const refs = await seedFullRoute(rig);
    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'mg-life-cycle',
        members: [{ publicModelId: refs.publicModelId, priority: 10 }],
      },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { id: string }).id;

    const list = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
    });
    expect(list.statusCode).toBe(200);
    const items = (list.json() as { items: Array<{ id: string }> }).items;
    expect(items.some((it) => it.id === id)).toBe(true);

    const got = await rig.app.inject({
      method: 'GET',
      url: `/api/admin/model-groups/${id}`,
      headers: { cookie: rig.cookie },
    });
    expect(got.statusCode).toBe(200);
    expect((got.json() as { id: string }).id).toBe(id);

    const missing = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/model-groups/mg_doesnotexist',
      headers: { cookie: rig.cookie },
    });
    expect(missing.statusCode).toBe(404);

    const refresh = await rig.app.inject({
      method: 'POST',
      url: `/api/admin/model-groups/${id}/refresh-auto`,
      headers: { cookie: rig.cookie },
    });
    // The group was created in manual mode, so refresh-auto must reject.
    expect(refresh.statusCode).toBeGreaterThanOrEqual(400);

    const del = await rig.app.inject({
      method: 'DELETE',
      url: `/api/admin/model-groups/${id}`,
      headers: { cookie: rig.cookie },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ id, deleted: true });

    const tn = await rig.db
      .select()
      .from(targetNames)
      .where(eq(targetNames.targetId, id))
      .all();
    expect(tn).toHaveLength(0);
  });

  it('rejects refresh-auto on unknown id', async () => {
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups/mg_doesnot_exist/refresh-auto',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('patches description / enabled / routingPolicy / displayName on an existing group', async () => {
    const refs = await seedFullRoute(rig);
    void refs;
    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: { name: 'mg-patch' },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { id: string }).id;

    const patched = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/model-groups/${id}`,
      headers: { cookie: rig.cookie },
      payload: {
        description: 'manual coder route',
        displayName: 'Manual Coder',
        enabled: false,
        routingPolicy: 'random',
      },
    });
    expect(patched.statusCode).toBe(200);
    const body = patched.json() as {
      description: string | null;
      displayName: string | null;
      enabled: boolean;
      routingPolicy: string;
    };
    expect(body.description).toBe('manual coder route');
    expect(body.displayName).toBe('Manual Coder');
    expect(body.enabled).toBe(false);
    expect(body.routingPolicy).toBe('random');
  });

  it('load-more-auto appends 5 more members ranked by preset, skipping existing ids', async () => {
    const now = new Date();

    // Seed 7 public models + matching reference rows so the auto
    // ranking has enough candidates to fill two batches of 5. The
    // reference rows must exist BEFORE the group is created, otherwise
    // `applyAutoGroupSnapshot` throws "no matching public models".
    for (let i = 0; i < 7; i++) {
      const name = `ref-coder-${i}`;
      const pmId = generateId('publicModel');
      await rig.db.insert(publicModels).values({
        id: pmId,
        name,
        displayName: name,
        description: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
      await rig.db.insert(targetNames).values({
        id: `tn_${pmId.slice(-6)}`,
        name,
        targetType: 'public_model',
        targetId: pmId,
        createdAt: now,
      });
      const refId = generateId('modelReference');
      await rig.db.insert(modelReferenceEntries).values({
        id: refId,
        region: 'global',
        source: 'rele',
        // The public-model match map normalizes both sides the same
        // way, so we use the raw public model name verbatim here.
        normalizedModelName: name,
        sourceModelId: refId,
        displayName: name,
        provider: 'test',
        // Higher index = higher score = ranks higher under the `code`
        // preset (coding weight is the dominant signal).
        scoresJson: JSON.stringify({ coding: 50 + i * 5, intelligence: 50 }),
        priceJson: '{}',
        contextWindow: null,
        sourceUrl: 'https://example.com/test',
        fetchedAt: now,
        updatedAt: now,
      });
    }

    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'mg-load-more',
        mode: 'auto_snapshot',
        autoPreset: 'code',
        autoTopN: 5,
      },
    });
    expect(created.statusCode).toBe(200);
    const realGroupId = (created.json() as { id: string }).id;

    const initial = await rig.app.inject({
      method: 'GET',
      url: `/api/admin/model-groups/${realGroupId}`,
      headers: { cookie: rig.cookie },
    });
    const initialMembers = (initial.json() as { members: Array<{ publicModelId: string }> })
      .members;
    expect(initialMembers).toHaveLength(5);

    const loadMore = await rig.app.inject({
      method: 'POST',
      url: `/api/admin/model-groups/${realGroupId}/load-more-auto`,
      headers: { cookie: rig.cookie },
    });
    expect(loadMore.statusCode).toBe(200);
    const body = loadMore.json() as {
      added: number;
      members: Array<{ publicModelId: string; priority: number; enabled: boolean }>;
    };
    // 7 candidates − 5 already in the group = 2 left to add.
    expect(body.added).toBe(2);
    expect(body.members).toHaveLength(7);

    // Existing member ids must still be present, and load-more must
    // NOT re-add any of them.
    const idsAfter = new Set(body.members.map((m) => m.publicModelId));
    for (const m of initialMembers) {
      expect(idsAfter.has(m.publicModelId)).toBe(true);
    }
    // Strictly increasing ordering: each new row uses +10 step, so
    // there are no two members with the same priority.
    const priorities = body.members.map((m) => m.priority).sort((a, b) => a - b);
    expect(new Set(priorities).size).toBe(priorities.length);
    // All members should remain enabled by default.
    expect(body.members.every((m) => m.enabled === true)).toBe(true);

    // A second load-more should report 0 added (no more candidates).
    const loadMoreAgain = await rig.app.inject({
      method: 'POST',
      url: `/api/admin/model-groups/${realGroupId}/load-more-auto`,
      headers: { cookie: rig.cookie },
    });
    expect(loadMoreAgain.statusCode).toBe(200);
    expect((loadMoreAgain.json() as { added: number }).added).toBe(0);
  });

  it('PATCH /:id/members/:memberId toggles a single member without losing auto config', async () => {
    const now = new Date();
    // Seed a public model + reference + auto group.
    const pmId = generateId('publicModel');
    await rig.db.insert(publicModels).values({
      id: pmId,
      name: 'ref-coder-toggle',
      displayName: 'ref-coder-toggle',
      description: null,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await rig.db.insert(targetNames).values({
      id: `tn_${pmId.slice(-6)}`,
      name: 'ref-coder-toggle',
      targetType: 'public_model',
      targetId: pmId,
      createdAt: now,
    });
    const refId = generateId('modelReference');
    await rig.db.insert(modelReferenceEntries).values({
      id: refId,
      region: 'global',
      source: 'rele',
      normalizedModelName: 'ref-coder-toggle',
      sourceModelId: refId,
      displayName: 'ref-coder-toggle',
      provider: 'test',
      scoresJson: JSON.stringify({ coding: 80 }),
      priceJson: '{}',
      contextWindow: null,
      sourceUrl: 'https://example.com/test',
      fetchedAt: now,
      updatedAt: now,
    });

    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'mg-toggle',
        mode: 'auto_snapshot',
        autoPreset: 'code',
        autoTopN: 1,
      },
    });
    expect(created.statusCode).toBe(200);
    const groupId = (created.json() as { id: string }).id;
    const get = await rig.app.inject({
      method: 'GET',
      url: `/api/admin/model-groups/${groupId}`,
      headers: { cookie: rig.cookie },
    });
    const memberId = (get.json() as { members: Array<{ id: string }> }).members[0]!.id;

    // Toggle off — group must still be auto_snapshot afterwards.
    const off = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/model-groups/${groupId}/members/${memberId}`,
      headers: { cookie: rig.cookie },
      payload: { enabled: false },
    });
    expect(off.statusCode).toBe(200);
    const offBody = off.json() as { members: Array<{ enabled: boolean }> };
    expect(offBody.members[0]!.enabled).toBe(false);

    const afterToggle = await rig.app.inject({
      method: 'GET',
      url: `/api/admin/model-groups/${groupId}`,
      headers: { cookie: rig.cookie },
    });
    const afterBody = afterToggle.json() as { mode: string; members: Array<{ enabled: boolean }> };
    expect(afterBody.mode).toBe('auto_snapshot');
    expect(afterBody.members[0]!.enabled).toBe(false);

    // Toggle back on.
    const on = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/model-groups/${groupId}/members/${memberId}`,
      headers: { cookie: rig.cookie },
      payload: { enabled: true },
    });
    expect(on.statusCode).toBe(200);
    expect((on.json() as { members: Array<{ enabled: boolean }> }).members[0]!.enabled).toBe(true);

    // Reject non-boolean body.
    const bad = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/model-groups/${groupId}/members/${memberId}`,
      headers: { cookie: rig.cookie },
      payload: { enabled: 'no' },
    });
    expect(bad.statusCode).toBe(400);

    // 404 on unknown member id.
    const notFound = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/model-groups/${groupId}/members/mgMember_doesnotexist`,
      headers: { cookie: rig.cookie },
      payload: { enabled: false },
    });
    expect(notFound.statusCode).toBe(404);
  });

  it('falls back to manual mode when an auto_snapshot request finds no reference data', async () => {
    // No public models with reference rows exist at this point. The
    // admin asks for auto_snapshot with a sensible preset+topN, but
    // the reference table is empty so previewAutoGroupMembers returns
    // zero matches. The server should silently downgrade to manual
    // and create the group with 0 members — the admin can then add
    // members via the manual UI.
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'mg-fallback',
        mode: 'auto_snapshot',
        autoPreset: 'code',
        autoTopN: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      mode: 'manual' | 'auto_snapshot';
      members: Array<unknown>;
      autoPreset: string | null;
    };
    expect(body.mode).toBe('manual');
    expect(body.members).toEqual([]);
    // The autoPreset is null because we downgraded — we never
    // accepted the autoPreset on a row whose mode is manual.
    expect(body.autoPreset).toBeNull();
  });

  it('silently treats an unknown preset as null and downgrades to manual mode', async () => {
    // The create payload carries `autoPreset: 'not-a-real-preset'`.
    // The server rejects the unknown preset (silently treated as
    // `null`), so `autoPreset` is unset → `resolvedMode` stays in the
    // "missing data" branch and falls back to manual with 0 members.
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'mg-bad-preset',
        mode: 'auto_snapshot',
        autoPreset: 'not-a-real-preset',
        autoTopN: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      mode: 'manual' | 'auto_snapshot';
      members: Array<unknown>;
      autoPreset: string | null;
    };
    expect(body.mode).toBe('manual');
    expect(body.members).toEqual([]);
    expect(body.autoPreset).toBeNull();
  });
});
