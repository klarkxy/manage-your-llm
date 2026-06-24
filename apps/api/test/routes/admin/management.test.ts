import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../../src/server/build-server.js';
import { createTestDb } from '../../../src/infrastructure/db/test-helper.js';

describe('admin management routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let appId: string;
  let upstreamKeyId: string;
  let publicModelId: string;

  beforeAll(async () => {
    const testDb = await createTestDb();
    app = await buildServer({
      disableBackgroundJobs: true,
      logger: false,
      databaseUrl: `file:${testDb.filePath}`,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    expect(login.statusCode).toBe(200);
    cookie = login.cookies.find((c) => c.name === 'session')!.value;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists provider presets including builtins', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/provider-presets',
      cookies: { session: cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.some((p: { source: string }) => p.source === 'builtin')).toBe(true);
    expect(body.data[0]).toHaveProperty('descriptorJson.endpoints');
  });

  it('creates and manages apps', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/apps',
      cookies: { session: cookie },
      payload: { name: 'Test App', description: 'test' },
    });
    expect(create.statusCode).toBe(200);
    const createBody = JSON.parse(create.payload);
    appId = createBody.data.id;
    expect(appId).toMatch(/^app_/);

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/apps',
      cookies: { session: cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.payload).data.some((a: { id: string }) => a.id === appId)).toBe(true);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/apps/${appId}`,
      cookies: { session: cookie },
      payload: { description: 'updated' },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.payload).data.description).toBe('updated');
  });

  it('creates and manages upstream keys without exposing secrets', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/upstream-keys',
      cookies: { session: cookie },
      payload: {
        name: 'Test Upstream',
        providerType: 'openai_compatible',
        baseUrl: 'https://api.example.com',
        apiKey: 'sk-test-secret',
      },
    });
    expect(create.statusCode).toBe(200);
    const createBody = JSON.parse(create.payload);
    upstreamKeyId = createBody.data.id;
    expect(createBody.data.apiKeyPrefix).toBe('sk-t');
    expect(createBody.data).not.toHaveProperty('apiKeyCiphertext');
    expect(createBody.data).not.toHaveProperty('authConfigCiphertext');

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/upstream-keys',
      cookies: { session: cookie },
    });
    expect(list.statusCode).toBe(200);
    const listBody = JSON.parse(list.payload);
    expect(listBody.data.some((u: { id: string }) => u.id === upstreamKeyId)).toBe(true);

    const rotate = await app.inject({
      method: 'POST',
      url: `/api/admin/upstream-keys/${upstreamKeyId}/rotate`,
      cookies: { session: cookie },
      payload: { apiKey: 'sk-new-secret' },
    });
    expect(rotate.statusCode).toBe(200);
    expect(JSON.parse(rotate.payload).data.apiKeyPrefix).toBe('sk-n');

    const freeze = await app.inject({
      method: 'POST',
      url: `/api/admin/upstream-keys/${upstreamKeyId}/freeze`,
      cookies: { session: cookie },
      payload: { reason: 'maintenance' },
    });
    expect(freeze.statusCode).toBe(200);
    expect(JSON.parse(freeze.payload).data.frozen).toBe(true);

    const unfreeze = await app.inject({
      method: 'POST',
      url: `/api/admin/upstream-keys/${upstreamKeyId}/unfreeze`,
      cookies: { session: cookie },
      payload: {},
    });
    expect(unfreeze.statusCode).toBe(200);
    expect(JSON.parse(unfreeze.payload).data.frozen).toBe(false);

    const reorder = await app.inject({
      method: 'POST',
      url: '/api/admin/upstream-keys/reorder',
      cookies: { session: cookie },
      payload: [{ id: upstreamKeyId, displayOrder: 500 }],
    });
    expect(reorder.statusCode).toBe(200);
  });

  it('creates and manages public models', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/public-models',
      cookies: { session: cookie },
      payload: {
        name: 'test-model',
        displayName: 'Test Model',
        candidates: [{ upstreamKeyId, realModelName: 'gpt-4o' }],
      },
    });
    expect(create.statusCode).toBe(200);
    const createBody = JSON.parse(create.payload);
    publicModelId = createBody.data.id;
    expect(createBody.data.candidates).toHaveLength(1);

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/public-models',
      cookies: { session: cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.payload).data.some((m: { id: string }) => m.id === publicModelId)).toBe(
      true,
    );

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/public-models/${publicModelId}`,
      cookies: { session: cookie },
      payload: { displayName: 'Updated Model' },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.payload).data.displayName).toBe('Updated Model');

    const candidate = createBody.data.candidates[0];
    const reorder = await app.inject({
      method: 'POST',
      url: `/api/admin/public-models/${publicModelId}/candidates/reorder`,
      cookies: { session: cookie },
      payload: [{ candidateId: candidate.id, priority: 50 }],
    });
    expect(reorder.statusCode).toBe(200);
    expect(JSON.parse(reorder.payload).data.candidates[0].priority).toBe(50);
  });

  it('creates and manages model groups', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/model-groups',
      cookies: { session: cookie },
      payload: {
        name: 'test-group',
        members: [{ publicModelId, priority: 100 }],
      },
    });
    expect(create.statusCode).toBe(200);
    const groupId = JSON.parse(create.payload).data.id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/model-groups',
      cookies: { session: cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.payload).data.some((g: { id: string }) => g.id === groupId)).toBe(true);

    const replace = await app.inject({
      method: 'POST',
      url: `/api/admin/model-groups/${groupId}/members/replace`,
      cookies: { session: cookie },
      payload: { members: [{ publicModelId, priority: 200 }] },
    });
    expect(replace.statusCode).toBe(200);
    expect(JSON.parse(replace.payload).data.members[0].priority).toBe(200);
  });

  it('creates, rotates and revokes consumer keys', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/consumer-keys',
      cookies: { session: cookie },
      payload: { appId, name: 'Test Key' },
    });
    expect(create.statusCode).toBe(200);
    const createBody = JSON.parse(create.payload);
    const keyId = createBody.data.consumerKey.id;
    expect(createBody.data.rawKey).toMatch(/^ck_/);
    expect(createBody.data.consumerKey).not.toHaveProperty('keyHash');

    const list = await app.inject({
      method: 'GET',
      url: `/api/admin/consumer-keys?appId=${appId}`,
      cookies: { session: cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.payload).data.some((k: { id: string }) => k.id === keyId)).toBe(true);

    const rotate = await app.inject({
      method: 'POST',
      url: `/api/admin/consumer-keys/${keyId}/rotate`,
      cookies: { session: cookie },
      payload: {},
    });
    expect(rotate.statusCode).toBe(200);
    expect(JSON.parse(rotate.payload).data.rawKey).toMatch(/^ck_/);

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/admin/consumer-keys/${keyId}/revoke`,
      cookies: { session: cookie },
      payload: {},
    });
    expect(revoke.statusCode).toBe(200);
    expect(JSON.parse(revoke.payload).data.consumerKey.enabled).toBe(false);
  });

  it('creates and lists backups', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/backups',
      cookies: { session: cookie },
      payload: {},
    });
    expect(create.statusCode).toBe(200);
    const backupId = JSON.parse(create.payload).data.id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/backups',
      cookies: { session: cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.payload).data.some((b: { id: string }) => b.id === backupId)).toBe(true);
  });

  it('gets and updates settings', async () => {
    const get = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      cookies: { session: cookie },
    });
    expect(get.statusCode).toBe(200);
    const body = JSON.parse(get.payload);
    expect(body.data).toHaveProperty('gatewayBasePath');

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/admin/settings',
      cookies: { session: cookie },
      payload: {
        gatewayBasePath: '/gateway',
        defaultRequestTimeoutMs: 60_000,
        enableStickySession: false,
      },
    });
    expect(patch.statusCode).toBe(200);
    const patched = JSON.parse(patch.payload);
    expect(patched.data.gatewayBasePath).toBe('/gateway');
    expect(patched.data.defaultRequestTimeoutMs).toBe(60_000);
    expect(patched.data.enableStickySession).toBe(false);
  });
});
