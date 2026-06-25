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
import { resetEnvForTests } from '../../src/config/env.js';

describe('gateway default retries', () => {
  const originalFetch = globalThis.fetch;
  let app: Awaited<ReturnType<typeof buildServer>>;
  let rawKey: string;
  let dbFilePath: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MYLLM_SECRET_KEY = 'test-secret-key-32chars-long!!';
    process.env.MYLLM_ADMIN_USERNAME = 'admin';
    process.env.MYLLM_ADMIN_PASSWORD = 'password123';
    process.env.MYLLM_ADMIN_DISPLAY_NAME = 'Admin';
    resetEnvForTests();

    const testDb = await createTestDb();
    const { db, client } = testDb;
    dbFilePath = testDb.filePath;

    const appRow = await new AppRepository(db).createApp({ name: 'retry-app', enabled: true });
    const consumer = await new ConsumerKeyService(db).createConsumerKey({
      appId: appRow.id,
      name: 'default',
      accessMode: 'all',
    });
    rawKey = consumer.rawKey;

    const upstreamService = new UpstreamKeyService(db, process.env.MYLLM_SECRET_KEY);
    const upstream1 = await upstreamService.createUpstreamKey({
      name: 'upstream-1',
      providerType: 'openai_compatible',
      baseUrl: 'https://upstream-1.example.com',
      apiKey: 'sk-1',
    });
    const upstream2 = await upstreamService.createUpstreamKey({
      name: 'upstream-2',
      providerType: 'openai_compatible',
      baseUrl: 'https://upstream-2.example.com',
      apiKey: 'sk-2',
    });

    const publicModel = await new PublicModelRepository(db).createPublicModel({
      name: 'gpt-retry',
      displayName: 'GPT Retry',
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
      name: 'gpt-retry',
      targetType: 'public_model',
      targetId: publicModel.id,
    });

    await new SettingsRepository(db).seedDefaultSettings();
    await new SettingsRepository(db).updateSettings({ defaultRetries: 1 });

    app = await buildServer({
      db,
      client,
      logger: false,
      disableBackgroundJobs: true,
    });
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

  it('retries up to defaultRetries + 1 candidates and succeeds on the second', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          status: 500,
          ok: false,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ error: { message: 'first upstream down' } }),
        } as Response;
      }
      return {
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () =>
          JSON.stringify({
            id: 'chatcmpl-retry',
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
      payload: JSON.stringify({ model: 'gpt-retry', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.choices[0].message.content).toBe('from second upstream');
    expect(callCount).toBe(2);
  });

  it('stops after defaultRetries + 1 attempts and returns the last error', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return {
        status: 500,
        ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: { message: `upstream ${callCount} down` } }),
      } as Response;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ model: 'gpt-retry', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.statusCode).toBe(502);
    expect(callCount).toBe(2);
  });
});
