import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTestDb } from '../../src/infrastructure/db/test-helper.js';
import { MaintenanceService } from '../../src/application/maintenance.service.js';
import { UpstreamKeyService } from '../../src/application/upstream-key.service.js';
import { AppRepository } from '../../src/infrastructure/db/repositories/app.repository.js';
import { ConsumerKeyService } from '../../src/domain/identity-access/consumer-key.service.js';
import { SettingsRepository } from '../../src/infrastructure/db/repositories/settings.repository.js';
import { UpstreamKeyRepository } from '../../src/infrastructure/db/repositories/upstream-key.repository.js';
import { RoutingStateRepository } from '../../src/infrastructure/db/repositories/routing-state.repository.js';
import { ObservabilityRepository } from '../../src/infrastructure/db/repositories/observability.repository.js';
import { AdminUserRepository } from '../../src/infrastructure/db/repositories/admin-user.repository.js';
import { resetEnvForTests } from '../../src/config/env.js';
import { generateId } from '@manageyourllm/shared';

describe('maintenance service', () => {
  let dbFilePath: string;
  let db: import('../../src/infrastructure/db/client.js').Db;
  let client: { close(): Promise<void> };
  let upstreamId: string;
  let appId: string;
  let consumerKeyId: string;

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
      name: 'maintenance-upstream',
      providerType: 'openai_compatible',
      baseUrl: 'https://maint.example.com',
      apiKey: 'sk-maint',
    });
    upstreamId = upstream.id;

    const app = await new AppRepository(db).createApp({ name: 'maint-app', enabled: true });
    appId = app.id;
    const consumer = await new ConsumerKeyService(db).createConsumerKey({
      appId: app.id,
      name: 'maint-key',
      accessMode: 'all',
    });
    consumerKeyId = consumer.consumerKey.id;
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

  it('clears expired upstream cooldowns', async () => {
    const repo = new UpstreamKeyRepository(db);
    await repo.updateCooldown(upstreamId, new Date(Date.now() - 60_000));

    const maintenance = new MaintenanceService({ db });
    await maintenance.run();

    const updated = await repo.findById(upstreamId);
    expect(updated?.cooldownUntil).toBeNull();
  });

  it('deletes expired sticky bindings', async () => {
    const routingRepo = new RoutingStateRepository(db);
    const longAgo = new Date(Date.now() - 60_000);
    // use the real app and consumer key created in beforeAll
    const fingerprint = 'fp-1';
    await routingRepo.upsertStickyBinding({
      appId,
      consumerKeyId,
      requestedTargetName: 'expired-binding',
      conversationFingerprint: fingerprint,
      upstreamKeyId: upstreamId,
      realModelName: 'model',
      expiresAt: longAgo,
      lastUsedAt: longAgo,
    });

    const maintenance = new MaintenanceService({ db });
    await maintenance.run();

    const found = await routingRepo.findStickyBinding(
      appId,
      consumerKeyId,
      'expired-binding',
      fingerprint,
    );
    expect(found).toBeUndefined();
  });

  it('deletes old trace logs', async () => {
    const obsRepo = new ObservabilityRepository(db);
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const requestTraceId = generateId('trace');
    await obsRepo.insertTraceLog({
      requestTraceId,
      step: 'old_event',
      stepIndex: 0,
      appId: generateId('app'),
      consumerKeyId: generateId('consumerKey'),
      requestedTargetName: 'old-target',
      createdAt: old,
    });

    const maintenance = new MaintenanceService({ db });
    await maintenance.run();

    const logs = await obsRepo.listTraceLogsByRequestTraceId(requestTraceId);
    expect(logs.length).toBe(0);
  });

  it('deletes expired admin sessions', async () => {
    const adminRepo = new AdminUserRepository(db);
    const admin = await adminRepo.createAdmin({
      username: 'maint-admin',
      passwordHash: 'hash',
      displayName: 'Maint',
    });
    const expired = new Date(Date.now() - 60_000);
    await adminRepo.createSession({
      adminUserId: admin.id,
      sessionHash: 'expired-session',
      expiresAt: expired,
      lastSeenAt: expired,
    });

    const maintenance = new MaintenanceService({ db });
    await maintenance.run();

    const found = await adminRepo.findSessionByHash('expired-session');
    expect(found).toBeUndefined();
  });
});
