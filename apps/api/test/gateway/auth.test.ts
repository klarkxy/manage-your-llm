import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server/build-server.js';
import { createTestDb, type TestDb } from '../../src/infrastructure/db/test-helper.js';
import { AppRepository } from '../../src/infrastructure/db/repositories/app.repository.js';
import { ConsumerKeyService } from '../../src/domain/identity-access/consumer-key.service.js';

describe('gateway auth', () => {
  let app: FastifyInstance;
  let testDb: TestDb;
  let rawKey: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = await buildServer({
      disableBackgroundJobs: true,
      logger: false,
      databaseUrl: `file:${testDb.filePath}`,
    });

    const appRepo = new AppRepository(testDb.db);
    const createdApp = await appRepo.createApp({ name: 'Gateway Test App', enabled: true });
    const consumerService = new ConsumerKeyService(testDb.db);
    const result = await consumerService.createConsumerKey({ appId: createdApp.id, name: 'test-key' });
    rawKey = result.rawKey;
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  it('allows request with Authorization: Bearer ck_...', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${rawKey}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.object).toBe('list');
  });

  it('allows request with x-api-key header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { 'x-api-key': rawKey },
    });
    expect(res.statusCode).toBe(200);
  });

  it('prefers Authorization over x-api-key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${rawKey}`, 'x-api-key': 'invalid' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects missing key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error.type).toBe('AuthenticationError');
  });

  it('rejects invalid key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: 'Bearer ck_invalid' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects revoked key', async () => {
    const appRepo = new AppRepository(testDb.db);
    const createdApp = await appRepo.createApp({ name: 'Revoked App', enabled: true });
    const consumerService = new ConsumerKeyService(testDb.db);
    const result = await consumerService.createConsumerKey({ appId: createdApp.id, name: 'revoked-key' });

    await consumerService.revokeConsumerKey(result.consumerKey.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${result.rawKey}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects key from disabled app', async () => {
    const appRepo = new AppRepository(testDb.db);
    const createdApp = await appRepo.createApp({ name: 'Disabled App', enabled: false });
    const consumerService = new ConsumerKeyService(testDb.db);
    const result = await consumerService.createConsumerKey({ appId: createdApp.id, name: 'disabled-app-key' });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/models',
      headers: { authorization: `Bearer ${result.rawKey}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
