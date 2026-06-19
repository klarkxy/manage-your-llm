import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import {
  modelGroupMembers,
  modelGroups,
  publicModelCandidates,
  publicModels,
  upstreamKeys,
} from '../src/modules/db/index.js';
import { makeGatewayRig, type GatewayTestRig } from './gateway-helper.js';

const ANTHROPIC_BODY = (model: string, content: string) => ({
  model,
  messages: [{ role: 'user', content }],
  max_tokens: 64,
});

function anthropicHeader(key: string): Record<string, string> {
  return { 'x-api-key': key, 'content-type': 'application/json' };
}

async function addGroupMember(rig: GatewayTestRig, publicModelName: string, realModelName: string) {
  const now = new Date();
  const pmId = generateId('publicModel');
  await rig.db.insert(publicModels).values({
    id: pmId,
    name: publicModelName,
    displayName: publicModelName,
    description: null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  await rig.db.insert(publicModelCandidates).values({
    id: generateId('publicModel') + '_c',
    publicModelId: pmId,
    upstreamKeyId: rig.upstreamKeyId,
    realModelName,
    enabled: true,
    priority: 100,
    weight: 1,
    createdAt: now,
    updatedAt: now,
  });
  await rig.db.insert(modelGroupMembers).values({
    id: generateId('modelGroup') + '_m',
    modelGroupId: rig.ids.modelGroupId,
    publicModelId: pmId,
    enabled: true,
    priority: 100,
    weight: 1,
    createdAt: now,
    updatedAt: now,
  });
}

describe('group balancer gateway integration', () => {
  let rig: GatewayTestRig;
  beforeEach(async () => {
    rig = await makeGatewayRig();
    // Disable session sticky so repeated calls can observe rotation.
    await rig.db
      .update(upstreamKeys)
      .set({ stickySessionTtlMs: 0 })
      .where(eq(upstreamKeys.id, rig.upstreamKeyId));
    // The default seeded group member points at a different public model;
    // disable it so the tests see only the members they add.
    await rig.db
      .update(modelGroupMembers)
      .set({ enabled: false })
      .where(eq(modelGroupMembers.modelGroupId, rig.ids.modelGroupId));
  });
  afterEach(async () => {
    await rig.close();
  });

  it('round robin rotates requests across group members', async () => {
    await addGroupMember(rig, 'member-a', 'real-model-a');
    await addGroupMember(rig, 'member-b', 'real-model-b');
    await rig.db
      .update(modelGroups)
      .set({ routingPolicy: 'round_robin' })
      .where(eq(modelGroups.id, rig.ids.modelGroupId));

    rig.fake.setAnthropicResponse({
      status: 200,
      body: {
        id: 'msg_default',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        model: 'fake',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });

    const first = await rig.app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: anthropicHeader(rig.rawConsumerKey),
      payload: ANTHROPIC_BODY('coding', 'first'),
    });
    expect(first.statusCode).toBe(200);
    const firstModel = (rig.fake.anthropicRequests.at(-1)!.body as { model: string }).model;

    const second = await rig.app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: anthropicHeader(rig.rawConsumerKey),
      payload: ANTHROPIC_BODY('coding', 'second'),
    });
    expect(second.statusCode).toBe(200);
    const secondModel = (rig.fake.anthropicRequests.at(-1)!.body as { model: string }).model;

    expect(new Set([firstModel, secondModel])).toEqual(new Set(['real-model-a', 'real-model-b']));
    expect(firstModel).not.toBe(secondModel);
  });

  it('failover keeps priority order for group requests', async () => {
    await addGroupMember(rig, 'member-low', 'real-low-priority');
    await addGroupMember(rig, 'member-high', 'real-high-priority');
    await rig.db
      .update(modelGroups)
      .set({ routingPolicy: 'failover' })
      .where(eq(modelGroups.id, rig.ids.modelGroupId));
    // Force the lower-priority member to be tried first by ordering input
    // candidates backwards; the balancer should reorder by priority.
    await rig.db
      .update(modelGroupMembers)
      .set({ priority: 200 })
      .where(eq(modelGroupMembers.publicModelId, (await publicModelByName(rig.db, 'member-low'))!));
    await rig.db
      .update(modelGroupMembers)
      .set({ priority: 10 })
      .where(
        eq(modelGroupMembers.publicModelId, (await publicModelByName(rig.db, 'member-high'))!),
      );

    rig.fake.setAnthropicResponse({
      status: 200,
      body: {
        id: 'msg_default',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        model: 'fake',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });

    const res = await rig.app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: anthropicHeader(rig.rawConsumerKey),
      payload: ANTHROPIC_BODY('coding', 'priority-test'),
    });
    expect(res.statusCode).toBe(200);
    const model = (rig.fake.anthropicRequests.at(-1)!.body as { model: string }).model;
    expect(model).toBe('real-high-priority');
  });
});

async function publicModelByName(
  db: GatewayTestRig['db'],
  name: string,
): Promise<string | undefined> {
  const row = await db
    .select({ id: publicModels.id })
    .from(publicModels)
    .where(eq(publicModels.name, name))
    .get();
  return row?.id;
}
