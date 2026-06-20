import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { modelGroups } from '../src/modules/db/tables/models.js';
import { targetNames } from '../src/modules/db/tables/routing.js';
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
});
