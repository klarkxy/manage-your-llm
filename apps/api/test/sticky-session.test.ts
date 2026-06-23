import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import { apps, consumerKeys } from '../src/modules/db/tables/apps.js';
import { stickySessions } from '../src/modules/db/tables/routing.js';
import { upstreamKeys } from '../src/modules/db/tables/upstream.js';
import { encryptUpstreamApiKey } from '../src/modules/admin/index.js';
import {
  DEFAULT_SESSION_STICKY_TTL_MS,
  getStickySessionTtlMs,
  isStickySessionValid,
  lookupStickySession,
  pruneExpiredStickySessions,
  touchStickySession,
  upsertStickySession,
} from '../src/modules/sticky/session.js';
import { runMaintenancePass } from '../src/modules/jobs/index.js';
import { makeAdminRig, type AdminTestRig } from './helper.js';

async function seedUpstreamKey(
  rig: AdminTestRig,
  overrides: { name?: string; stickySessionTtlMs?: number | null } = {},
): Promise<{ id: string }> {
  const now = new Date();
  const id = generateId('upstreamKey');
  const enc = encryptUpstreamApiKey('sk-test', rig.secretKey);
  await rig.db.insert(upstreamKeys).values({
    id,
    name: overrides.name ?? id,
    providerType: 'anthropic_compatible',
    baseUrl: 'https://api.example.com',
    apiKeyCiphertext: enc.ciphertext,
    apiKeyPrefix: enc.prefix,
    supportedModelsJson: '[]',
    enabled: true,
    frozen: false,
    stickySessionTtlMs: overrides.stickySessionTtlMs ?? DEFAULT_SESSION_STICKY_TTL_MS,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

async function seedConsumer(rig: AdminTestRig): Promise<{ appId: string; consumerKeyId: string }> {
  const now = new Date();
  const appId = generateId('app');
  await rig.db.insert(apps).values({
    id: appId,
    name: appId,
    description: null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  const consumerKeyId = generateId('consumerKey');
  await rig.db.insert(consumerKeys).values({
    id: consumerKeyId,
    appId,
    name: 'Test key',
    keyHash: '0'.repeat(64),
    keyPrefix: 'mh_test',
    keySuffix: 'mh_test',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return { appId, consumerKeyId };
}

describe('sticky session: lookupStickySession', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('returns no binding when the row does not exist', async () => {
    const { consumerKeyId } = await seedConsumer(rig);
    const result = await lookupStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      now: new Date(),
    });
    expect(result.binding).toBeNull();
    expect(result.hit).toBe(false);
  });

  it('reports a hit when the binding is still fresh', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      now,
    });
    const result = await lookupStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      now: new Date(now.getTime() + 30_000),
    });
    expect(result.binding).not.toBeNull();
    expect(result.hit).toBe(true);
  });

  it('reports a miss when the binding has expired', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 1_000,
      now,
    });
    const result = await lookupStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      now: new Date(now.getTime() + 2_000),
    });
    expect(result.binding).not.toBeNull();
    expect(result.hit).toBe(false);
  });
});

describe('sticky session: upsertStickySession', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('creates a binding on first call and refreshes it on subsequent calls', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { consumerKeyId } = await seedConsumer(rig);
    const now = new Date();

    const first = await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      now,
    });
    expect(first).not.toBeNull();
    expect(first!.hitCount).toBe(1);

    const later = new Date(now.getTime() + 30_000);
    const second = await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o-real',
      ttlMs: 120_000,
      now: later,
    });
    expect(second).not.toBeNull();
    expect(second!.hitCount).toBe(2);
    expect(second!.realModelName).toBe('gpt-4o-real');
    expect(second!.expiresAt.getTime()).toBeGreaterThan(first!.expiresAt.getTime());

    const rows = await rig.db.select().from(stickySessions).all();
    expect(rows).toHaveLength(1);
  });
});

describe('sticky session: isStickySessionValid', () => {
  it('rejects expired bindings', () => {
    const binding = {
      id: 'ss_1',
      consumerKeyId: 'ck_1',
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: 'uk_1',
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      hitCount: 1,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() - 1_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const accepted = [
      {
        upstreamKeyId: 'uk_1',
        realModelName: 'gpt-4o',
        upstreamEnabled: true,
        upstreamFrozen: false,
        cooldownUntil: null,
      },
    ] as import('../src/modules/router/candidates.js').ResolvedCandidate[];
    expect(isStickySessionValid(binding, accepted, { now: new Date() })).toBe(false);
  });

  it('rejects bindings whose candidate is no longer accepted', () => {
    const binding = {
      id: 'ss_1',
      consumerKeyId: 'ck_1',
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: 'uk_1',
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      hitCount: 1,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(isStickySessionValid(binding, [], { now: new Date() })).toBe(false);
  });

  it('accepts a fresh binding whose candidate is still valid', () => {
    const now = new Date();
    const binding = {
      id: 'ss_1',
      consumerKeyId: 'ck_1',
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: 'uk_1',
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      hitCount: 1,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    };
    const accepted = [
      {
        upstreamKeyId: 'uk_1',
        realModelName: 'gpt-4o',
        upstreamEnabled: true,
        upstreamFrozen: false,
        cooldownUntil: null,
      },
    ] as import('../src/modules/router/candidates.js').ResolvedCandidate[];
    expect(isStickySessionValid(binding, accepted, { now })).toBe(true);
  });
});

describe('sticky session: touchStickySession', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('bumps hit count and extends expiry', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    const created = await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      now,
    });
    const later = new Date(now.getTime() + 30_000);
    await touchStickySession(rig.db, { id: created!.id, ttlMs: 120_000, now: later });
    const row = await rig.db
      .select()
      .from(stickySessions)
      .where(eq(stickySessions.id, created!.id))
      .get();
    expect(row).toBeDefined();
    expect(row!.hitCount).toBe(2);
    expect(row!.expiresAt.getTime()).toBe(later.getTime() + 120_000);
  });
});

describe('sticky session: pruneExpiredStickySessions', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('removes only expired session bindings', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'expired',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 1_000,
      now: new Date(now.getTime() - 2_000),
    });
    await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'live',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 60_000,
      now,
    });

    const removed = await pruneExpiredStickySessions(rig.db, now);
    expect(removed).toBe(1);

    const remaining = await rig.db.select().from(stickySessions).all();
    expect(remaining.map((r) => r.requestedTargetName)).toEqual(['live']);
  });
});

describe('sticky session: getStickySessionTtlMs', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('returns the configured TTL or the default', async () => {
    const { id: customId } = await seedUpstreamKey(rig, { stickySessionTtlMs: 123_456 });
    const { id: defaultId } = await seedUpstreamKey(rig, { name: 'default-ttl' });

    expect(await getStickySessionTtlMs(rig.db, customId)).toBe(123_456);
    expect(await getStickySessionTtlMs(rig.db, defaultId)).toBe(DEFAULT_SESSION_STICKY_TTL_MS);
    expect(await getStickySessionTtlMs(rig.db, 'does-not-exist')).toBe(
      DEFAULT_SESSION_STICKY_TTL_MS,
    );
  });
});

describe('sticky session: maintenance pass', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('counts pruned session bindings in the maintenance result', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    await upsertStickySession(rig.db, {
      consumerKeyId,
      requestedTargetName: 'old',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      ttlMs: 1_000,
      now: new Date(now.getTime() - 2_000),
    });

    const result = await runMaintenancePass(rig.db, now);
    expect(result.stickySessionsRemoved).toBe(1);
  });
});
