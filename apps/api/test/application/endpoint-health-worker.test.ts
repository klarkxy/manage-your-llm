import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTestDb } from '../../src/infrastructure/db/test-helper.js';
import { UpstreamKeyService } from '../../src/application/upstream-key.service.js';
import { SettingsRepository } from '../../src/infrastructure/db/repositories/settings.repository.js';
import { UpstreamKeyRepository } from '../../src/infrastructure/db/repositories/upstream-key.repository.js';
import { RoutingStateRepository } from '../../src/infrastructure/db/repositories/routing-state.repository.js';
import { EndpointHealthWorker } from '../../src/application/endpoint-health-worker.js';
import { UpstreamSender } from '../../src/gateway/upstream-sender.js';
import { resetEnvForTests } from '../../src/config/env.js';

describe('endpoint health worker', () => {
  let dbFilePath: string;
  let upstreamId: string;
  let db: import('../../src/infrastructure/db/client.js').Db;
  let client: { close(): Promise<void> };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MYLLM_SECRET_KEY = 'test-secret-key-32chars-long!!';
    resetEnvForTests();

    const testDb = await createTestDb();
    db = testDb.db;
    client = testDb.client;
    dbFilePath = testDb.filePath;

    await new SettingsRepository(db).seedDefaultSettings();

    const service = new UpstreamKeyService(db, process.env.MYLLM_SECRET_KEY);
    const upstream = await service.createUpstreamKey({
      name: 'health-upstream',
      providerType: 'openai_compatible',
      baseUrl: 'https://health.example.com',
      apiKey: 'sk-health',
    });
    upstreamId = upstream.id;
  }, 60_000);

  afterAll(async () => {
    await client.close();
    await new Promise((r) => setTimeout(r, 100));
    await rm(dirname(dbFilePath), {
      force: true,
      recursive: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }, 60_000);

  it('records healthy status on 200 within latency threshold', async () => {
    const sender = new UpstreamSender({
      fetch: async () =>
        ({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ data: [] }),
        }) as Response,
    });

    const worker = new EndpointHealthWorker({
      db,
      secretKey: process.env.MYLLM_SECRET_KEY!,
      sender,
    });
    const upstream = (await new UpstreamKeyRepository(db).findById(upstreamId))!;
    const result = await worker.probeOne(upstream);

    expect(result.ok).toBe(true);

    const health = await new RoutingStateRepository(db).findEndpointHealth(
      upstreamId,
      'https://health.example.com',
    );
    expect(health).toBeDefined();
    expect(health!.degraded).toBe(false);

    const updated = await new UpstreamKeyRepository(db).findById(upstreamId);
    expect(updated?.lastHealthStatus).toBe('healthy');
  });

  it('records degraded status on slow response', async () => {
    await new SettingsRepository(db).updateSettings({ endpointHealthProbeDegradedLatencyMs: 5 });

    const sender = new UpstreamSender({
      fetch: async () => {
        await new Promise((r) => setTimeout(r, 10));
        return {
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ data: [] }),
        } as Response;
      },
    });

    const worker = new EndpointHealthWorker({
      db,
      secretKey: process.env.MYLLM_SECRET_KEY!,
      sender,
    });
    const upstream = (await new UpstreamKeyRepository(db).findById(upstreamId))!;
    await worker.probeOne(upstream);

    const updated = await new UpstreamKeyRepository(db).findById(upstreamId);
    expect(updated?.lastHealthStatus).toBe('degraded');
  });

  it('records unhealthy status on non-2xx response', async () => {
    const sender = new UpstreamSender({
      fetch: async () =>
        ({
          status: 503,
          ok: false,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ error: { message: 'down' } }),
        }) as Response,
    });

    const worker = new EndpointHealthWorker({
      db,
      secretKey: process.env.MYLLM_SECRET_KEY!,
      sender,
    });
    const upstream = (await new UpstreamKeyRepository(db).findById(upstreamId))!;
    const result = await worker.probeOne(upstream);

    expect(result.ok).toBe(false);

    const updated = await new UpstreamKeyRepository(db).findById(upstreamId);
    expect(updated?.lastHealthStatus).toBe('unhealthy');
  });
});
