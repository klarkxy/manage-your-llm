import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildServer } from '../../src/server/build-server.js';
import { createTestDb } from '../../src/infrastructure/db/test-helper.js';
import { AppRepository } from '../../src/infrastructure/db/repositories/app.repository.js';
import { ConsumerKeyService } from '../../src/domain/identity-access/consumer-key.service.js';
import { UpstreamKeyService } from '../../src/application/upstream-key.service.js';
import { PublicModelRepository } from '../../src/infrastructure/db/repositories/public-model.repository.js';
import { TargetRepository } from '../../src/infrastructure/db/repositories/target.repository.js';
import { SettingsRepository } from '../../src/infrastructure/db/repositories/settings.repository.js';
import { UpstreamKeyRepository } from '../../src/infrastructure/db/repositories/upstream-key.repository.js';
import { resetEnvForTests } from '../../src/config/env.js';

describe('gateway upstream cooldown', () => {
  const originalFetch = globalThis.fetch;
  let app: Awaited<ReturnType<typeof buildServer>>;
  let rawKey: string;
  let dbFilePath: string;
  let upstream1Id: string;
  let upstream2Id: string;
  let db: import('../../src/infrastructure/db/client.js').Db;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MYLLM_SECRET_KEY = 'test-secret-key-32chars-long!!';
    process.env.MYLLM_ADMIN_USERNAME = 'admin';
    process.env.MYLLM_ADMIN_PASSWORD = 'password123';
    process.env.MYLLM_ADMIN_DISPLAY_NAME = 'Admin';
    resetEnvForTests();

    const testDb = await createTestDb();
    db = testDb.db;
    const { client } = testDb;
    dbFilePath = testDb.filePath;

    const appRow = await new AppRepository(db).createApp({ name: 'cooldown-app', enabled: true });
    const consumer = await new ConsumerKeyService(db).createConsumerKey({
      appId: appRow.id,
      name: 'default',
      accessMode: 'all',
    });
    rawKey = consumer.rawKey;

    const upstreamService = new UpstreamKeyService(db, process.env.MYLLM_SECRET_KEY);
    const upstream1 = await upstreamService.createUpstreamKey({
      name: 'cooldown-upstream-1',
      providerType: 'openai_compatible',
      baseUrl: 'https://cooldown-1.example.com',
      apiKey: 'sk-1',
    });
    upstream1Id = upstream1.id;
    const upstream2 = await upstreamService.createUpstreamKey({
      name: 'cooldown-upstream-2',
      providerType: 'openai_compatible',
      baseUrl: 'https://cooldown-2.example.com',
      apiKey: 'sk-2',
    });
    upstream2Id = upstream2.id;

    const publicModel = await new PublicModelRepository(db).createPublicModel({
      name: 'gpt-cooldown',
      displayName: 'GPT Cooldown',
    });
    await new PublicModelRepository(db).createCandidate({
      publicModelId: publicModel.id,
      upstreamKeyId: upstream1.id,
      realModelName: 'model-1',
      enabled: true,
      priority: 100,
      weight: 1,
    });
    await new PublicModelRepository(db).createCandidate({
      publicModelId: publicModel.id,
      upstreamKeyId: upstream2.id,
      realModelName: 'model-2',
      enabled: true,
      priority: 200,
      weight: 1,
    });
    await new TargetRepository(db).createTargetName({
      name: 'gpt-cooldown',
      targetType: 'public_model',
      targetId: publicModel.id,
    });

    await new SettingsRepository(db).seedDefaultSettings();

    app = await buildServer({
      db,
      client,
      logger: false,
      disableBackgroundJobs: true,
    });
  });

  beforeEach(async () => {
    const repo = new UpstreamKeyRepository(db);
    for (const id of [upstream1Id, upstream2Id]) {
      await repo.updateCooldown(id, null);
    }
  });

  afterAll(async () => {
    await app.close();
    globalThis.fetch = originalFetch;
    await new Promise((r) => setTimeout(r, 100));
    await rm(dirname(dbFilePath), {
      force: true,
      recursive: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });

  it('sets upstream cooldown after a retriable failure', async () => {
    globalThis.fetch = async () =>
      ({
        status: 503,
        ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: { message: 'rate limited' } }),
      }) as Response;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        model: 'gpt-cooldown',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    expect(res.statusCode).toBe(502);

    const repo = new UpstreamKeyRepository(db);
    const upstream = await repo.findById(upstream1Id);
    expect(upstream?.cooldownUntil).toBeDefined();
    expect(upstream!.cooldownUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('filters out upstream in cooldown on the next request', async () => {
    const repo = new UpstreamKeyRepository(db);
    const now = new Date();
    await repo.updateCooldown(upstream1Id, new Date(now.getTime() + 60_000));

    let attemptedUrl: string | undefined;
    globalThis.fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      attemptedUrl = url;
      return {
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () =>
          JSON.stringify({
            id: 'chatcmpl-cooldown',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'model-2',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'from second upstream' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
      } as Response;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        model: 'gpt-cooldown',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(attemptedUrl).toContain('cooldown-2.example.com');
  });
});
