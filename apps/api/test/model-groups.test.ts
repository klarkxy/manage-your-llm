import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { modelGroups, targetNames } from '../src/modules/db/index.js';
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
});
