import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import {
  modelGroups,
  modelGroupMembers,
  publicModels,
  publicModelCandidates,
  upstreamKeys,
} from '../src/modules/db/index.js';
import { encryptUpstreamApiKey } from '../src/modules/admin/index.js';
import type { ResolvedCandidate } from '../src/modules/router/candidates.js';
import {
  balanceGroupCandidates,
  maybeBalanceGroupCandidates,
  isGroupBalanceMode,
} from '../src/modules/router/group-balancer.js';
import { makeAdminRig, type AdminTestRig } from './helper.js';

function fakeCandidate(overrides: Partial<ResolvedCandidate> & { id: string }): ResolvedCandidate {
  const base: ResolvedCandidate = {
    upstreamKeyId: `uk_${overrides.id}`,
    upstreamKeyName: `key-${overrides.id}`,
    providerType: 'anthropic_compatible',
    baseUrl: 'https://api.example.com',
    authType: 'pat',
    authConfigCiphertext: null,
    apiKeyCiphertext: 'enc',
    realModelName: `model-${overrides.id}`,
    upstreamEnabled: true,
    upstreamFrozen: false,
    cooldownUntil: null,
    priority: 100,
    weight: 1,
    publicModelId: `pm_${overrides.id}`,
    publicModelName: `public-${overrides.id}`,
    candidateEnabled: true,
    publicModelEnabled: true,
    endpointProtocol: 'anthropic',
    endpointBaseUrl: 'https://api.example.com',
    endpointsJson: null,
    providerPresetId: null,
    extraHeaders: {},
    extraParams: {},
    capabilities: { supportsStreaming: true, supportsNonStreaming: true, protocols: ['anthropic'] },
    memberWeight: overrides.memberWeight,
    ...overrides,
  };
  return base;
}

async function seedGroup(rig: AdminTestRig, routingPolicy: string) {
  const now = new Date();
  const enc = encryptUpstreamApiKey('sk-test', rig.secretKey);
  const ukId = generateId('upstreamKey');
  await rig.db.insert(upstreamKeys).values({
    id: ukId,
    name: 'Test upstream',
    providerType: 'anthropic_compatible',
    baseUrl: 'https://api.example.com',
    apiKeyCiphertext: enc.ciphertext,
    apiKeyPrefix: enc.prefix,
    supportedModelsJson: JSON.stringify(['model-a', 'model-b']),
    enabled: true,
    frozen: false,
    createdAt: now,
    updatedAt: now,
  });

  const pmA = generateId('publicModel');
  const pmB = generateId('publicModel');
  await rig.db.insert(publicModels).values([
    {
      id: pmA,
      name: 'public-a',
      displayName: null,
      description: null,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: pmB,
      name: 'public-b',
      displayName: null,
      description: null,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await rig.db.insert(publicModelCandidates).values([
    {
      id: generateId('publicModelCandidate'),
      publicModelId: pmA,
      upstreamKeyId: ukId,
      realModelName: 'model-a',
      priority: 10,
      weight: 1,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId('publicModelCandidate'),
      publicModelId: pmB,
      upstreamKeyId: ukId,
      realModelName: 'model-b',
      priority: 20,
      weight: 1,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const mgId = generateId('modelGroup');
  await rig.db.insert(modelGroups).values({
    id: mgId,
    name: `mg-${routingPolicy}`,
    displayName: null,
    description: null,
    enabled: true,
    routingPolicy,
    createdAt: now,
    updatedAt: now,
  });
  await rig.db.insert(modelGroupMembers).values([
    {
      id: generateId('modelGroup') + '_m',
      modelGroupId: mgId,
      publicModelId: pmA,
      enabled: true,
      priority: 10,
      weight: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId('modelGroup') + '_m',
      modelGroupId: mgId,
      publicModelId: pmB,
      enabled: true,
      priority: 20,
      weight: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return {
    groupId: mgId,
    candidateA: fakeCandidate({
      id: 'a',
      upstreamKeyId: ukId,
      realModelName: 'model-a',
      priority: 10,
      publicModelId: pmA,
      memberWeight: 3,
    }),
    candidateB: fakeCandidate({
      id: 'b',
      upstreamKeyId: ukId,
      realModelName: 'model-b',
      priority: 20,
      publicModelId: pmB,
      memberWeight: 1,
    }),
  };
}

describe('group balancer', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('validates known balance modes', () => {
    expect(isGroupBalanceMode('priority')).toBe(true);
    expect(isGroupBalanceMode('failover')).toBe(true);
    expect(isGroupBalanceMode('round_robin')).toBe(true);
    expect(isGroupBalanceMode('random')).toBe(true);
    expect(isGroupBalanceMode('weighted')).toBe(true);
    expect(isGroupBalanceMode('unknown')).toBe(false);
  });

  it('failover orders by priority ascending', async () => {
    const a = fakeCandidate({ id: 'a', priority: 20 });
    const b = fakeCandidate({ id: 'b', priority: 10 });
    const out = await balanceGroupCandidates(rig.db, {
      modelGroupId: 'g1',
      mode: 'failover',
      candidates: [a, b],
      now: new Date(),
    });
    expect(out.map((c) => c.realModelName)).toEqual(['model-b', 'model-a']);
  });

  it('priority alias behaves like failover', async () => {
    const a = fakeCandidate({ id: 'a', priority: 20 });
    const b = fakeCandidate({ id: 'b', priority: 10 });
    const out = await balanceGroupCandidates(rig.db, {
      modelGroupId: 'g1',
      mode: 'priority',
      candidates: [a, b],
      now: new Date(),
    });
    expect(out.map((c) => c.realModelName)).toEqual(['model-b', 'model-a']);
  });

  it('round robin advances the group counter and rotates the list', async () => {
    const seeded = await seedGroup(rig, 'round_robin');
    const first = await balanceGroupCandidates(rig.db, {
      modelGroupId: seeded.groupId,
      mode: 'round_robin',
      candidates: [seeded.candidateA, seeded.candidateB],
      now: new Date(),
    });
    expect(first.map((c) => c.realModelName)).toEqual(['model-a', 'model-b']);

    const second = await balanceGroupCandidates(rig.db, {
      modelGroupId: seeded.groupId,
      mode: 'round_robin',
      candidates: [seeded.candidateA, seeded.candidateB],
      now: new Date(),
    });
    expect(second.map((c) => c.realModelName)).toEqual(['model-b', 'model-a']);

    const row = await rig.db
      .select({ counter: modelGroups.roundRobinCounter })
      .from(modelGroups)
      .where(eq(modelGroups.id, seeded.groupId))
      .get();
    expect(row?.counter).toBe(2);
  });

  it('random returns a permutation of the candidates', async () => {
    const a = fakeCandidate({ id: 'a' });
    const b = fakeCandidate({ id: 'b' });
    const c = fakeCandidate({ id: 'c' });
    const out = await balanceGroupCandidates(rig.db, {
      modelGroupId: 'g1',
      mode: 'random',
      candidates: [a, b, c],
      now: new Date(),
    });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((x) => x.realModelName))).toEqual(
      new Set(['model-a', 'model-b', 'model-c']),
    );
  });

  it('weighted puts selected first and keeps the rest in failover order', async () => {
    const heavy = fakeCandidate({ id: 'heavy', priority: 200, memberWeight: 100 });
    const light = fakeCandidate({ id: 'light', priority: 100, memberWeight: 1 });
    // With these weights the heavy candidate should almost always be selected.
    const out = await balanceGroupCandidates(rig.db, {
      modelGroupId: 'g1',
      mode: 'weighted',
      candidates: [light, heavy],
      now: new Date(),
    });
    expect(out[0]).toBe(heavy);
    expect(out[out.length - 1]).toBe(light);
  });

  it('weighted falls back to failover when all weights are zero', async () => {
    const a = fakeCandidate({ id: 'a', priority: 20, memberWeight: 0 });
    const b = fakeCandidate({ id: 'b', priority: 10, memberWeight: 0 });
    const out = await balanceGroupCandidates(rig.db, {
      modelGroupId: 'g1',
      mode: 'weighted',
      candidates: [a, b],
      now: new Date(),
    });
    expect(out.map((c) => c.realModelName)).toEqual(['model-b', 'model-a']);
  });

  it('maybeBalanceGroupCandidates returns candidates unchanged for public_model targets', async () => {
    const a = fakeCandidate({ id: 'a' });
    const result = await maybeBalanceGroupCandidates(
      rig.db,
      { targetType: 'public_model', targetId: 'pm1' },
      [a],
      new Date(),
    );
    expect(result.candidates).toEqual([a]);
    expect(result.mode).toBeUndefined();
  });

  it('maybeBalanceGroupCandidates reads the policy from the database', async () => {
    const seeded = await seedGroup(rig, 'round_robin');
    const result = await maybeBalanceGroupCandidates(
      rig.db,
      { targetType: 'model_group', targetId: seeded.groupId },
      [seeded.candidateA, seeded.candidateB],
      new Date(),
    );
    expect(result.mode).toBe('round_robin');
    expect(result.candidates).toHaveLength(2);
  });
});
