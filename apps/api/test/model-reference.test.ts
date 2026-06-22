import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from '@modelharbor/shared';
import { makeAdminRig } from './helper.js';
import {
  modelGroupMembers,
  publicModels,
} from '../src/modules/db/schema.js';

const openRouterPayload = {
  data: [
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek: DeepSeek Chat',
      context_length: 64000,
      pricing: { prompt: '0.000001', completion: '0.000002' },
      benchmarks: {
        artificial_analysis: {
          intelligence_index: 86,
          coding_index: 82,
          agentic_index: 72,
          math_index: 78,
        },
      },
    },
    {
      id: 'qwen/qwen-plus',
      name: 'Qwen: Qwen Plus',
      context_length: 131000,
      pricing: { prompt: '0.000002', completion: '0.000003' },
      benchmarks: {
        artificial_analysis: {
          intelligence_index: 82,
          coding_index: 78,
          agentic_index: 70,
        },
      },
    },
    {
      id: 'moonshotai/kimi-k2',
      name: 'MoonshotAI: Kimi K2',
      context_length: 128000,
      pricing: { prompt: '0.000002', completion: '0.000006' },
      benchmarks: {
        artificial_analysis: {
          intelligence_index: 84,
          coding_index: 86,
          agentic_index: 73,
          reasoning_index: 81,
        },
      },
    },
    {
      id: 'openai/gpt-4.1',
      name: 'OpenAI: GPT-4.1',
      context_length: 1000000,
      pricing: { prompt: '0.000002', completion: '0.000008' },
      benchmarks: {
        artificial_analysis: {
          intelligence_index: 90,
          coding_index: 88,
          agentic_index: 80,
        },
      },
    },
  ],
};

function mockOpenRouter() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => openRouterPayload,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function seedPublicModel(rig: Awaited<ReturnType<typeof makeAdminRig>>, name: string) {
  const now = new Date();
  const id = generateId('publicModel');
  await rig.db.insert(publicModels).values({
    id,
    name,
    displayName: name,
    description: null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe('model reference admin API', () => {
  it('keeps domestic reference refresh isolated and respects TTL', async () => {
    const rig = await makeAdminRig();
    try {
      mockOpenRouter();
      const refreshed = await rig.app.inject({
        method: 'POST',
        url: '/api/admin/model-reference/refresh',
        headers: { cookie: rig.cookie },
        payload: { region: 'domestic', force: true },
      });
      expect(refreshed.statusCode).toBe(200);
      expect(refreshed.json().refreshed).toBe(true);
      expect(refreshed.json().source).toBe('openrouter');

      const domestic = await rig.app.inject({
        method: 'GET',
        url: '/api/admin/model-reference?region=domestic',
        headers: { cookie: rig.cookie },
      });
      expect(domestic.statusCode).toBe(200);
      expect(domestic.json().items.length).toBeGreaterThan(0);

      const international = await rig.app.inject({
        method: 'GET',
        url: '/api/admin/model-reference?region=international',
        headers: { cookie: rig.cookie },
      });
      expect(international.statusCode).toBe(200);
      expect(international.json().items).toHaveLength(0);

      const cached = await rig.app.inject({
        method: 'POST',
        url: '/api/admin/model-reference/refresh',
        headers: { cookie: rig.cookie },
        payload: { region: 'domestic', force: false },
      });
      expect(cached.statusCode).toBe(200);
      expect(cached.json().refreshed).toBe(false);
    } finally {
      await rig.close();
    }
  }, 20_000);

  it('creates auto groups as member snapshots and refreshes only on demand', async () => {
    const rig = await makeAdminRig();
    try {
      mockOpenRouter();
      const deepseekId = await seedPublicModel(rig, 'deepseek-chat');
      await seedPublicModel(rig, 'qwen-plus');
      await rig.app.inject({
        method: 'POST',
        url: '/api/admin/model-reference/refresh',
        headers: { cookie: rig.cookie },
        payload: { region: 'domestic', force: true },
      });

      const created = await rig.app.inject({
        method: 'POST',
        url: '/api/admin/model-groups',
        headers: { cookie: rig.cookie },
        payload: {
          name: 'auto-code',
          mode: 'auto_snapshot',
          autoReferenceRegion: 'domestic',
          autoPreset: 'code',
          autoWeights: { coding: 1 },
          autoTopN: 1,
        },
      });
      expect(created.statusCode).toBe(200);
      const group = created.json();
      expect(group.mode).toBe('auto_snapshot');
      expect(group.autoReferenceRegion).toBe('domestic');
      expect(group.members).toHaveLength(1);
      expect(group.members[0].publicModelId).toBe(deepseekId);

      const kimiId = await seedPublicModel(rig, 'kimi-k2');
      await rig.app.inject({
        method: 'POST',
        url: '/api/admin/model-reference/refresh',
        headers: { cookie: rig.cookie },
        payload: { region: 'domestic', force: true },
      });
      const beforeManualRefresh = await rig.db
        .select()
        .from(modelGroupMembers)
        .where(eq(modelGroupMembers.modelGroupId, group.id))
        .all();
      expect(beforeManualRefresh).toHaveLength(1);
      expect(beforeManualRefresh[0]!.publicModelId).toBe(deepseekId);

      const refreshed = await rig.app.inject({
        method: 'POST',
        url: `/api/admin/model-groups/${group.id}/refresh-auto`,
        headers: { cookie: rig.cookie },
      });
      expect(refreshed.statusCode).toBe(200);
      expect(refreshed.json().members).toHaveLength(1);
      expect(refreshed.json().members[0].publicModelId).toBe(kimiId);
    } finally {
      await rig.close();
    }
  }, 20_000);
});
