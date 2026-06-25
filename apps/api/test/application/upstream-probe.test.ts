import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../../src/infrastructure/db/test-helper.js';
import { UpstreamKeyService } from '../../src/application/upstream-key.service.js';
import { UpstreamProbeService } from '../../src/application/upstream-probe.service.js';
import type { TestDb } from '../../src/infrastructure/db/test-helper.js';
import type { UpstreamSender, UpstreamResponse } from '../../src/gateway/upstream-sender.js';

function makeSender(
  response: Omit<UpstreamResponse, 'latencyMs'> & { latencyMs?: number },
): UpstreamSender {
  return {
    send: async () => ({ latencyMs: 0, ...response }) as UpstreamResponse,
  } as UpstreamSender;
}

describe('upstream probe service', () => {
  let testDb: TestDb;
  let service: UpstreamKeyService;

  beforeEach(async () => {
    testDb = await createTestDb();
    service = new UpstreamKeyService(testDb.db, 'test-secret-key');
  });

  afterEach(async () => {
    await testDb.close();
  });

  it('discovers models from upstream /v1/models', async () => {
    const key = await service.createUpstreamKey({
      name: 'Probe',
      providerType: 'openai_compatible',
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-probe',
    });

    const probe = new UpstreamProbeService({
      db: testDb.db,
      secretKey: 'test-secret-key',
      sender: makeSender({
        status: 200,
        headers: {},
        body: {
          data: [
            { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
            { id: 'gpt-4', object: 'model' },
          ],
        },
      }),
    });

    const models = await probe.discoverModels(key.id);
    expect(models).toEqual([
      { id: 'gpt-4o', object: 'model', ownedBy: 'openai' },
      { id: 'gpt-4', object: 'model' },
    ]);
  });

  it('throws when discover upstream returns non-2xx', async () => {
    const key = await service.createUpstreamKey({
      name: 'Probe',
      providerType: 'openai_compatible',
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-probe',
    });

    const probe = new UpstreamProbeService({
      db: testDb.db,
      secretKey: 'test-secret-key',
      sender: makeSender({ status: 401, headers: {}, body: { error: 'Unauthorized' } }),
    });

    await expect(probe.discoverModels(key.id)).rejects.toThrow('上游返回 401');
  });

  it('pings upstream chat completions', async () => {
    const key = await service.createUpstreamKey({
      name: 'Probe',
      providerType: 'openai_compatible',
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-probe',
      supportedModels: ['gpt-3.5-turbo'],
    });

    const probe = new UpstreamProbeService({
      db: testDb.db,
      secretKey: 'test-secret-key',
      sender: makeSender({ status: 200, headers: {}, body: { id: 'chatcmpl-1' } }),
    });

    const result = await probe.ping(key.id);
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeNull();
  });

  it('returns error details when ping upstream returns non-2xx', async () => {
    const key = await service.createUpstreamKey({
      name: 'Probe',
      providerType: 'openai_compatible',
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-probe',
      supportedModels: ['gpt-3.5-turbo'],
    });

    const probe = new UpstreamProbeService({
      db: testDb.db,
      secretKey: 'test-secret-key',
      sender: makeSender({
        status: 400,
        headers: {},
        body: { error: { message: 'invalid model' } },
      }),
    });

    const result = await probe.ping(key.id);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid model');
  });
});
