import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import { apps, consumerKeys, stickyBindings, upstreamKeys } from '../src/modules/db/index.js';
import { encryptUpstreamApiKey } from '../src/modules/admin/index.js';
import { pruneExpiredStickyBindings, upsertStickyBinding } from '../src/modules/sticky/index.js';
import { makeAdminRig, type AdminTestRig } from './helper.js';

async function seedUpstreamKey(rig: AdminTestRig): Promise<{ id: string }> {
  const now = new Date();
  const id = generateId('upstreamKey');
  const enc = encryptUpstreamApiKey('sk-test', rig.secretKey);
  await rig.db.insert(upstreamKeys).values({
    id,
    name: id,
    providerType: 'anthropic_compatible',
    baseUrl: 'https://api.example.com',
    apiKeyCiphertext: enc.ciphertext,
    apiKeyPrefix: enc.prefix,
    supportedModelsJson: '[]',
    enabled: true,
    frozen: false,
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
    // 32 hex chars of zero: a valid hash for the test rig (auth is not
    // exercised here, only the FK constraint).
    keyHash: '0'.repeat(64),
    keyPrefix: 'mh_test',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return { appId, consumerKeyId };
}

describe('sticky: pruneExpiredStickyBindings', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('removes only expired bindings and keeps the live ones', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { appId, consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    const past = new Date(now.getTime() - 5 * 60 * 1000);
    const future = new Date(now.getTime() + 60 * 60 * 1000);

    // One already-expired binding, one with a future expiry. The old buggy
    // `pruneExpiredStickyBindings` ran a `delete where id = id` before the
    // per-row loop, which would have wiped the live binding too.
    const expiredId = generateId('stickyBinding');
    const liveId = generateId('stickyBinding');
    await rig.db.insert(stickyBindings).values([
      {
        id: expiredId,
        appId,
        consumerKeyId,
        requestedTargetName: 'gpt-4o',
        conversationFingerprint: 'fp_expired',
        upstreamKeyId: ukId,
        realModelName: 'gpt-4o',
        hitCount: 0,
        lastUsedAt: past,
        expiresAt: past,
        createdAt: past,
        updatedAt: past,
      },
      {
        id: liveId,
        appId,
        consumerKeyId,
        requestedTargetName: 'gpt-4o',
        conversationFingerprint: 'fp_live',
        upstreamKeyId: ukId,
        realModelName: 'gpt-4o',
        hitCount: 0,
        lastUsedAt: now,
        expiresAt: future,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const removed = await pruneExpiredStickyBindings(rig.db, now);
    expect(removed).toBe(1);

    const remaining = await rig.db
      .select()
      .from(stickyBindings)
      .where(eq(stickyBindings.appId, appId))
      .all();
    expect(remaining.map((r) => r.id).sort()).toEqual([liveId]);
  });

  it('is a no-op when every binding is still fresh', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { appId, consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    await rig.db.insert(stickyBindings).values({
      id: generateId('stickyBinding'),
      appId,
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      conversationFingerprint: 'fp',
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      hitCount: 0,
      lastUsedAt: now,
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
    });

    const removed = await pruneExpiredStickyBindings(rig.db, now);
    expect(removed).toBe(0);
    const all = await rig.db.select().from(stickyBindings).all();
    expect(all).toHaveLength(1);
  });
});

describe('sticky: upsertStickyBinding', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('creates a binding on first call and refreshes expiresAt on subsequent calls', async () => {
    const { id: ukId } = await seedUpstreamKey(rig);
    const { appId, consumerKeyId } = await seedConsumer(rig);
    const now = new Date();
    const fp = 'fp_round_trip';

    await upsertStickyBinding(rig.db, {
      appId,
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      fingerprint: fp,
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      now,
    });
    const first = await rig.db
      .select()
      .from(stickyBindings)
      .where(eq(stickyBindings.conversationFingerprint, fp))
      .get();
    expect(first).toBeDefined();
    const firstExpires = first!.expiresAt.getTime();

    // A second upsert should update the same row (not create a duplicate)
    // and push the expiry forward.
    const later = new Date(now.getTime() + 30_000);
    await upsertStickyBinding(rig.db, {
      appId,
      consumerKeyId,
      requestedTargetName: 'gpt-4o',
      fingerprint: fp,
      upstreamKeyId: ukId,
      realModelName: 'gpt-4o',
      now: later,
    });
    const rows = await rig.db
      .select()
      .from(stickyBindings)
      .where(eq(stickyBindings.conversationFingerprint, fp))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.expiresAt.getTime()).toBeGreaterThan(firstExpires);
  });
});
