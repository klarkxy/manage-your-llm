import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server/build-server.js';
import { createTestDb, type TestDb } from '../../src/infrastructure/db/test-helper.js';
import { AppRepository } from '../../src/infrastructure/db/repositories/app.repository.js';
import { ConsumerKeyService } from '../../src/domain/identity-access/consumer-key.service.js';
import { UpstreamKeyService } from '../../src/application/upstream-key.service.js';
import { PublicModelService } from '../../src/domain/model-catalog/public-model.service.js';
import { ModelGroupService } from '../../src/domain/model-catalog/model-group.service.js';

describe('gateway /v1/models', () => {
  let app: FastifyInstance;
  let testDb: TestDb;
  let allKey: string;
  let restrictedKey: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = await buildServer({
      disableBackgroundJobs: true,
      logger: false,
      databaseUrl: `file:${testDb.filePath}`,
    });

    const appRepo = new AppRepository(testDb.db);
    const testApp = await appRepo.createApp({ name: 'Models Test App', enabled: true });

    const consumerService = new ConsumerKeyService(testDb.db);
    const allResult = await consumerService.createConsumerKey({
      appId: testApp.id,
      name: 'all-key',
      accessMode: 'all',
    });
    allKey = allResult.rawKey;

    const upstreamService = new UpstreamKeyService(testDb.db, 'test-secret');
    const upstream = await upstreamService.createUpstreamKey({
      name: 'test-upstream',
      providerType: 'openai_compatible',
      baseUrl: 'https://example.com',
      apiKey: 'sk-test',
    });

    const publicModelService = new PublicModelService(testDb.db);
    const gpt4o = await publicModelService.createPublicModel({
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      enabled: true,
      candidates: [{ upstreamKeyId: upstream.id, realModelName: 'gpt-4o-2024-08-06' }],
    });

    await publicModelService.createPublicModel({
      name: 'hidden-model',
      displayName: 'Hidden',
      enabled: true,
      candidates: [{ upstreamKeyId: upstream.id, realModelName: 'hidden-real' }],
    });

    const modelGroupService = new ModelGroupService(testDb.db);
    const fastGroup = await modelGroupService.createModelGroup({
      name: 'fast',
      displayName: 'Fast',
      enabled: true,
      members: [{ publicModelId: gpt4o.id }],
    });

    const restrictedResult = await consumerService.createConsumerKey({
      appId: testApp.id,
      name: 'restricted-key',
      accessMode: 'restricted',
      accessTargets: [
        { targetType: 'public_model', targetId: gpt4o.id },
        { targetType: 'model_group', targetId: fastGroup.id },
      ],
    });
    restrictedKey = restrictedResult.rawKey;
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  it('lists all enabled targets for all-access key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${allKey}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const ids = body.data.data.map((m: { id: string }) => m.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('hidden-model');
    expect(ids).toContain('fast');
  });

  it('lists only granted targets for restricted key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${restrictedKey}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const ids = body.data.data.map((m: { id: string }) => m.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('fast');
    expect(ids).not.toContain('hidden-model');
  });

  it('excludes disabled models', async () => {
    const publicModelService = new PublicModelService(testDb.db);
    await publicModelService.createPublicModel({
      name: 'disabled-model',
      displayName: 'Disabled',
      enabled: false,
      candidates: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${allKey}` },
    });
    const body = JSON.parse(res.payload);
    const ids = body.data.data.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('disabled-model');
  });
});
