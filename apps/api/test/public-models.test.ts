import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  publicModels,
  targetNames,
  publicModelCandidates,
  upstreamKeys,
} from '../src/modules/db/schema.js';
import { makeAdminRig, seedFullRoute, type AdminTestRig } from './helper.js';

describe('public models admin', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('creates a public model with candidates and a target_names row', async () => {
    const refs = await seedFullRoute(rig);
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'ds-pro',
        displayName: 'DS Pro',
        description: 'Pro model',
        candidates: [{ upstreamKeyId: refs.upstreamKeyId, realModelName: 'ds-v4-pro' }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      name: string;
      candidates: { realModelName: string }[];
      candidateCount: number;
    };
    expect(body.name).toBe('ds-pro');
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]!.realModelName).toBe('ds-v4-pro');
    const t = await rig.db.select().from(targetNames).where(eq(targetNames.name, 'ds-pro')).get();
    expect(t).toBeTruthy();
    expect(t!.targetType).toBe('public_model');
  });

  it('rejects duplicate names across public models and model groups', async () => {
    const refs = await seedFullRoute(rig);
    // seedFullRoute already created a public model "ds-v4-flash" and a model group "coding"
    const r1 = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: { name: 'coding' }, // conflict with the seeded model group
    });
    expect(r1.statusCode).toBeGreaterThanOrEqual(400);
    const r2 = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      headers: { cookie: rig.cookie },
      payload: { name: 'ds-v4-flash' }, // conflict with the seeded public model
    });
    expect(r2.statusCode).toBeGreaterThanOrEqual(400);
    void refs;
  });

  it('PUT candidates replaces the candidate list transactionally', async () => {
    const refs = await seedFullRoute(rig);
    const create = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'ds-mini',
        candidates: [{ upstreamKeyId: refs.upstreamKeyId, realModelName: 'ds-mini-old' }],
      },
    });
    const id = (create.json() as { id: string }).id;
    const put = await rig.app.inject({
      method: 'PUT',
      url: `/api/admin/public-models/${id}/candidates`,
      headers: { cookie: rig.cookie },
      payload: {
        candidates: [
          {
            upstreamKeyId: refs.upstreamKeyId,
            realModelName: 'ds-mini-v1',
            priority: 10,
            weight: 3,
            enabled: false,
          },
          {
            upstreamKeyId: refs.upstreamKeyId,
            realModelName: 'ds-mini-v2',
            priority: 20,
            weight: 7,
            enabled: true,
          },
        ],
      },
    });
    expect(put.statusCode).toBe(200);
    const candidates = await rig.db
      .select()
      .from(publicModelCandidates)
      .where(eq(publicModelCandidates.publicModelId, id))
      .all();
    expect(candidates).toHaveLength(2);
    const names = candidates.map((c) => c.realModelName).sort();
    expect(names).toEqual(['ds-mini-v1', 'ds-mini-v2']);
    const byName = new Map(candidates.map((c) => [c.realModelName, c]));
    expect(byName.get('ds-mini-v1')).toMatchObject({
      priority: 10,
      weight: 3,
      enabled: false,
    });
    expect(byName.get('ds-mini-v2')).toMatchObject({
      priority: 20,
      weight: 7,
      enabled: true,
    });
    const publicModel = await rig.db.select().from(publicModels).where(eq(publicModels.id, id)).get();
    expect(publicModel?.candidateOrderCustomized).toBe(true);
  });

  it('deletes a public model and its target_names row together', async () => {
    const refs = await seedFullRoute(rig);
    const del = await rig.app.inject({
      method: 'DELETE',
      url: `/api/admin/public-models/${refs.publicModelId}`,
      headers: { cookie: rig.cookie },
    });
    expect(del.statusCode).toBe(200);
    const pm = await rig.db
      .select()
      .from(publicModels)
      .where(eq(publicModels.id, refs.publicModelId))
      .get();
    expect(pm).toBeUndefined();
    const tn = await rig.db
      .select()
      .from(targetNames)
      .where(eq(targetNames.name, 'ds-v4-flash'))
      .get();
    expect(tn).toBeUndefined();
    // The seeded upstream key must still be present.
    const uk = await rig.db
      .select()
      .from(upstreamKeys)
      .where(eq(upstreamKeys.id, refs.upstreamKeyId))
      .get();
    expect(uk).toBeTruthy();
  });

  it('rejects names with bad characters', async () => {
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: { name: 'has space!' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('rolls back the whole create when a candidate points at a missing upstream key', async () => {
    const refs = await seedFullRoute(rig);
    void refs;
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'ds-rollback',
        candidates: [{ upstreamKeyId: 'upstreamKey_does-not-exist', realModelName: 'ds-x' }],
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    // Both the public model and its target_names row should be gone.
    const pm = await rig.db
      .select()
      .from(publicModels)
      .where(eq(publicModels.name, 'ds-rollback'))
      .get();
    expect(pm).toBeUndefined();
    const tn = await rig.db
      .select()
      .from(targetNames)
      .where(eq(targetNames.name, 'ds-rollback'))
      .get();
    expect(tn).toBeUndefined();
    // Name must be reusable after the failure.
    const retry = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: { name: 'ds-rollback' },
    });
    expect(retry.statusCode).toBe(200);
  });

  it('patches the displayName / description / enabled fields on an existing model', async () => {
    const refs = await seedFullRoute(rig);
    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: { name: 'ds-patch', displayName: 'Original' },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { id: string }).id;

    const patched = await rig.app.inject({
      method: 'PATCH',
      url: `/api/admin/public-models/${id}`,
      headers: { cookie: rig.cookie },
      payload: { displayName: 'Renamed', enabled: false, description: null },
    });
    expect(patched.statusCode).toBe(200);
    const body = patched.json() as { displayName: string; enabled: boolean; description: string | null };
    expect(body.displayName).toBe('Renamed');
    expect(body.enabled).toBe(false);
    expect(body.description).toBeNull();

    // PATCH on an unknown id returns 404.
    const missing = await rig.app.inject({
      method: 'PATCH',
      url: '/api/admin/public-models/pm_does_not_exist',
      headers: { cookie: rig.cookie },
      payload: { displayName: 'X' },
    });
    expect(missing.statusCode).toBe(404);
    void refs;
  });

  it('deletes a public model and its target_names row together', async () => {
    const refs = await seedFullRoute(rig);
    void refs;
    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'ds-del',
        candidates: [{ upstreamKeyId: refs.upstreamKeyId, realModelName: 'ds-v4-flash' }],
      },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { id: string }).id;

    const del = await rig.app.inject({
      method: 'DELETE',
      url: `/api/admin/public-models/${id}`,
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

  it('resets the candidate order to upstream-key-defined priorities', async () => {
    const refs = await seedFullRoute(rig);
    const created = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      headers: { cookie: rig.cookie },
      payload: {
        name: 'ds-reset',
        candidates: [
          { upstreamKeyId: refs.upstreamKeyId, realModelName: 'real-a', priority: 50 },
        ],
      },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { id: string }).id;

    const reset = await rig.app.inject({
      method: 'POST',
      url: `/api/admin/public-models/${id}/candidates/reset-order`,
      headers: { cookie: rig.cookie },
    });
    expect(reset.statusCode).toBe(200);
    const body = reset.json() as { candidates: Array<{ realModelName: string; priority: number }> };
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.candidates[0]?.realModelName).toBe('real-a');

    // Resetting an unknown id returns 404.
    const missing = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/public-models/pm_does_not_exist/candidates/reset-order',
      headers: { cookie: rig.cookie },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('returns 404 when GET /:id targets an unknown model', async () => {
    const missing = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/public-models/pm_does_not_exist',
      headers: { cookie: rig.cookie },
    });
    expect(missing.statusCode).toBe(404);
  });
});
