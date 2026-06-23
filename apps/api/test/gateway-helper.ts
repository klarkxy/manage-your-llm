import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import {
  apps,
  consumerKeyAccess,
  consumerKeys,
  createDb,
  initSchema,
  modelGroupMembers,
  modelGroups,
  publicModelCandidates,
  publicModels,
  targetNames,
  type Db,
  upstreamKeys,
} from '../src/modules/db/index.js';
import { adminSettings } from '../src/modules/db/tables/settings.js';
import { bootstrapAdmin } from '../src/modules/auth/index.js';
import { encryptUpstreamApiKey, generateConsumerKeyRaw } from '../src/modules/admin/index.js';
import { generateId, type ProviderType } from '@modelharbor/shared';
import { startFakeUpstream, type FakeUpstreamRig } from './fake-upstream.js';

export interface GatewayTestRig {
  app: FastifyInstance;
  db: Db;
  secretKey: string;
  fake: FakeUpstreamRig;
  ids: { appId: string; publicModelId: string; modelGroupId: string; consumerKeyId: string };
  rawConsumerKey: string;
  upstreamKeyId: string;
  rawUpstreamKey: string;
  close: () => Promise<void>;
}

export interface SeedRouteOptions {
  // Public model name the client will request. Defaults to "coding-fast".
  publicModelName?: string;
  // Whether the public model is enabled at seed time. Defaults to true.
  publicModelEnabled?: boolean;
  // Real model name to send upstream. Defaults to "fake-real-model".
  realModelName?: string;
  // Whether the candidate is enabled at seed time. Defaults to true.
  candidateEnabled?: boolean;
  // Upstream key provider type. Defaults to "anthropic_compatible".
  providerType?: ProviderType;
  // Whether the upstream key is enabled. Defaults to true.
  upstreamEnabled?: boolean;
  // Whether the upstream key is frozen. Defaults to false.
  upstreamFrozen?: boolean;
  // Cooldown until this time. Defaults to null.
  cooldownUntil?: Date | null;
  // Priority of the candidate. Defaults to 100.
  priority?: number;
  // Weight of the candidate. Defaults to 1.
  weight?: number;
  // supportedModels JSON value (the array of real model names this upstream
  // claims to support). Defaults to the realModelName.
  supportedModels?: string[];
  // Whether to create a model group that contains the public model. Defaults
  // to true; the consumer key gets access to the group, not the public model.
  createGroup?: boolean;
  // Whether the consumer key gets access to the public model. Defaults to
  // true so most tests can request the public model name directly.
  grantPublicModelAccess?: boolean;
  // Whether the consumer key gets access to the model group. Defaults to true
  // so group-routing tests work without extra setup.
  grantGroupAccess?: boolean;
  // Group member priority (only used when createGroup=true).
  memberPriority?: number;
  // Public-endpoints base path to seed into admin_settings BEFORE
  // `buildServer` runs. Defaults to the table's own default (`/v1`).
  // Used by tests that need to verify the gateway registers routes
  // under a non-default prefix.
  publicEndpointsBasePath?: string;
}

const TEST_SECRET = 'test-secret-key-for-m4';

function freshTestDbPath(): string {
  return join(tmpdir(), `mh-m4-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.db`);
}

// Build a fully wired M4 test rig: an admin/authenticated Fastify app, a real
// in-process fake upstream, and a seeded route. The seed can be customized via
// `seed` to exercise filtered or failover cases.
export async function makeGatewayRig(seed: SeedRouteOptions = {}): Promise<GatewayTestRig> {
  const dbFile = freshTestDbPath();
  const { db, client } = createDb({ url: `file:${dbFile}` });
  await initSchema(db);
  await bootstrapAdmin(db, { username: 'admin', password: 'secret123', displayName: 'Admin' });
  if (seed.publicEndpointsBasePath) {
    // Seed the public-endpoints base path BEFORE buildServer so the
    // gateway registers its routes at the requested prefix.
    const now = new Date();
    await db
      .insert(adminSettings)
      .values({
        id: 'default',
        publicEndpointsBasePath: seed.publicEndpointsBasePath,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: adminSettings.id,
        set: { publicEndpointsBasePath: seed.publicEndpointsBasePath, updatedAt: now },
      });
  }
  const app = await buildServer({
    db,
    logger: false,
    isProduction: false,
    secretKey: TEST_SECRET,
    disableBackgroundJobs: true,
  });
  await app.ready();

  const fake = await startFakeUpstream();
  const publicModelName = seed.publicModelName ?? 'coding-fast';
  const realModelName = seed.realModelName ?? 'fake-real-model';
  const providerType = seed.providerType ?? 'anthropic_compatible';
  const now = new Date();
  const rawUpstreamKey = 'sk-fake-upstream-key-XYZ';
  const enc = encryptUpstreamApiKey(rawUpstreamKey, TEST_SECRET);
  const ukId = generateId('upstreamKey');
  await db.insert(upstreamKeys).values({
    id: ukId,
    name: 'Test upstream',
    providerType,
    baseUrl: fake.baseUrl,
    apiKeyCiphertext: enc.ciphertext,
    apiKeyPrefix: enc.prefix,
    supportedModelsJson: JSON.stringify(seed.supportedModels ?? [realModelName]),
    enabled: seed.upstreamEnabled ?? true,
    frozen: seed.upstreamFrozen ?? false,
    cooldownUntil: seed.cooldownUntil ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const appId = generateId('app');
  await db.insert(apps).values({
    id: appId,
    name: 'Test app',
    description: null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });

  const pmId = generateId('publicModel');
  await db.insert(publicModels).values({
    id: pmId,
    name: publicModelName,
    displayName: publicModelName,
    description: null,
    enabled: seed.publicModelEnabled ?? true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(targetNames).values({
    id: `tn_${pmId.slice(-6)}`,
    name: publicModelName,
    targetType: 'public_model',
    targetId: pmId,
    createdAt: now,
  });
  await db.insert(publicModelCandidates).values({
    id: generateId('publicModel') + '_c',
    publicModelId: pmId,
    upstreamKeyId: ukId,
    realModelName,
    enabled: seed.candidateEnabled ?? true,
    priority: seed.priority ?? 100,
    weight: seed.weight ?? 1,
    createdAt: now,
    updatedAt: now,
  });

  let mgId = '';
  if (seed.createGroup !== false) {
    mgId = generateId('modelGroup');
    await db.insert(modelGroups).values({
      id: mgId,
      name: 'coding',
      displayName: 'Coding',
      description: null,
      enabled: true,
      routingPolicy: 'priority',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(targetNames).values({
      id: `tn_${mgId.slice(-6)}`,
      name: 'coding',
      targetType: 'model_group',
      targetId: mgId,
      createdAt: now,
    });
    await db.insert(modelGroupMembers).values({
      id: generateId('modelGroup') + '_m',
      modelGroupId: mgId,
      publicModelId: pmId,
      enabled: true,
      priority: seed.memberPriority ?? 100,
      weight: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  const ck = generateConsumerKeyRaw();
  const ckId = generateId('consumerKey');
  await db.insert(consumerKeys).values({
    id: ckId,
    appId,
    name: 'Test key',
    keyHash: ck.hash,
    keyPrefix: ck.prefix,
    keySuffix: ck.suffix,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  // By default the consumer key gets access to BOTH the public model and the
  // group. This keeps the gateway tests simple: they can request either name
  // and exercise the matching routing path. Tests that want to assert "no
  // access" can opt out of one or both.
  if (seed.grantPublicModelAccess !== false) {
    await db.insert(consumerKeyAccess).values({
      id: generateId('consumerKey') + '_a',
      consumerKeyId: ckId,
      targetType: 'public_model',
      targetId: pmId,
      createdAt: now,
    });
  }
  if (mgId && seed.grantGroupAccess !== false) {
    await db.insert(consumerKeyAccess).values({
      id: generateId('consumerKey') + '_a',
      consumerKeyId: ckId,
      targetType: 'model_group',
      targetId: mgId,
      createdAt: now,
    });
  }

  return {
    app,
    db,
    secretKey: TEST_SECRET,
    fake,
    rawConsumerKey: ck.raw,
    upstreamKeyId: ukId,
    rawUpstreamKey,
    ids: { appId, publicModelId: pmId, modelGroupId: mgId, consumerKeyId: ckId },
    close: async () => {
      await fake.close();
      await app.close();
      client.close();
      try {
        unlinkSync(dbFile);
      } catch {
        /* ignore */
      }
    },
  };
}

// Re-fetch a row by id. Used by tests that want to assert side effects.
export async function getUpstreamRow(db: Db, id: string) {
  return (await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get()) ?? null;
}
