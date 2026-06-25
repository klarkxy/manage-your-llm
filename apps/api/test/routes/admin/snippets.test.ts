import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../../src/server/build-server.js';
import { createTestDb } from '../../../src/infrastructure/db/test-helper.js';
import { SettingsService } from '../../../src/domain/settings/settings.service.js';
import type { TestDb } from '../../../src/infrastructure/db/test-helper.js';

describe('admin snippet routes', () => {
  let app: FastifyInstance;
  let testDb: TestDb;
  let cookie: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    app = await buildServer({
      db: testDb.db,
      client: testDb.client,
      disableBackgroundJobs: true,
      logger: false,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    expect(login.statusCode).toBe(200);
    cookie = login.cookies.find((c) => c.name === 'session')!.value;

    const settingsService = new SettingsService(testDb.db);
    await settingsService.updateSettings({ publicBaseUrl: 'https://myllm.example.com', gatewayBasePath: '/v1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a snippet for a valid client', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/snippets/generate',
      cookies: { session: cookie },
      payload: { client: 'generic_openai', model: 'gpt-5' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.client).toBe('generic_openai');
    expect(body.data.model).toBe('gpt-5');
    expect(body.data.gatewayUrl).toBe('https://myllm.example.com/v1');
    expect(body.data.content).toContain('/chat/completions');
    expect(body.data.content).toContain('<your-consumer-key>');
  });

  it('uses provided api key in snippet', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/snippets/generate',
      cookies: { session: cookie },
      payload: { client: 'generic_openai', model: 'gpt-5', apiKey: 'sk-real' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.content).toContain('sk-real');
    expect(body.data.apiKey).toBe('sk-real');
  });

  it('rejects an unknown client', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/snippets/generate',
      cookies: { session: cookie },
      payload: { client: 'unknown_client', model: 'gpt-5' },
    });
    expect(response.statusCode).toBe(400);
  });
});
