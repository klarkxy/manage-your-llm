// M6: optional prompt/response content logging.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { contentLogs } from '../src/modules/db/tables/observability.js';
import { makeGatewayRig, type GatewayTestRig } from './gateway-helper.js';
import { makeAdminRig, type AdminTestRig } from './helper.js';

describe('content logging', () => {
  let rig: GatewayTestRig;
  beforeEach(async () => {
    rig = await makeGatewayRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('does not write rows when content logging is disabled', async () => {
    rig.fake.enqueueAnthropicResponse({
      body: {
        id: 'msg_disabled',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        model: 'fake-real-model',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });

    const res = await rig.app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': rig.rawConsumerKey, 'content-type': 'application/json' },
      payload: { model: 'coding-fast', messages: [{ role: 'user', content: 'hi' }], max_tokens: 32 },
    });
    expect(res.statusCode).toBe(200);

    const rows = await rig.db.select().from(contentLogs).all();
    expect(rows).toHaveLength(0);
  });

  it('writes a redacted prompt/response row after a successful request', async () => {
    await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: await adminCookie(rig) },
      payload: { contentLogging: { enabled: true, retentionDays: 7, maxPayloadBytes: 100_000 } },
    });

    rig.fake.enqueueAnthropicResponse({
      body: {
        id: 'msg_enabled',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'logged' }],
        model: 'fake-real-model',
        stop_reason: 'end_turn',
        usage: { input_tokens: 2, output_tokens: 3 },
      },
    });

    const res = await rig.app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': rig.rawConsumerKey, 'content-type': 'application/json' },
      payload: {
        model: 'coding-fast',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 32,
      },
    });
    expect(res.statusCode).toBe(200);
    const traceId = res.headers['x-request-trace-id'] as string;

    const rows = await rig.db
      .select()
      .from(contentLogs)
      .where(eq(contentLogs.requestTraceId, traceId))
      .all();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.appId).toBe(rig.ids.appId);
    expect(row.consumerKeyId).toBe(rig.ids.consumerKeyId);
    expect(row.requestedTargetName).toBe('coding-fast');
    expect(row.upstreamKeyId).toBe(rig.upstreamKeyId);
    expect(row.realModelName).toBe('fake-real-model');
    expect(row.promptJson).toContain('hi');
    expect(row.responseJson).toContain('logged');
    expect(row.inputTokens).toBe(2);
    expect(row.outputTokens).toBe(3);
    expect(row.totalTokens).toBe(5);
    // Raw consumer key should never be stored.
    expect(row.promptJson?.includes(rig.rawConsumerKey)).toBe(false);
  });

  it('truncates payloads larger than maxPayloadBytes', async () => {
    await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: await adminCookie(rig) },
      payload: { contentLogging: { enabled: true, retentionDays: 7, maxPayloadBytes: 20 } },
    });

    rig.fake.enqueueAnthropicResponse({
      body: {
        id: 'msg_trunc',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'short' }],
        model: 'fake-real-model',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });

    const res = await rig.app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': rig.rawConsumerKey, 'content-type': 'application/json' },
      payload: {
        model: 'coding-fast',
        messages: [{ role: 'user', content: 'this is a longer prompt text' }],
        max_tokens: 32,
      },
    });
    expect(res.statusCode).toBe(200);
    const traceId = res.headers['x-request-trace-id'] as string;

    const rows = await rig.db
      .select()
      .from(contentLogs)
      .where(eq(contentLogs.requestTraceId, traceId))
      .all();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.promptJson).toContain('[truncated]');
  });
});

describe('content logging maintenance', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('prunes content logs older than the retention period', async () => {
    const now = new Date();
    const oldId = 'cl_old_1234';
    const freshId = 'cl_fresh_5678';
    await rig.db.insert(contentLogs).values([
      {
        id: oldId,
        requestTraceId: 'trace_old',
        appId: 'app_a',
        consumerKeyId: 'ck_a',
        requestedTargetName: 'model',
        resolvedTargetType: 'public_model',
        resolvedTargetId: 'pm_a',
        upstreamKeyId: 'uk_a',
        upstreamKeyName: 'Up',
        realModelName: 'real',
        promptJson: '{"x":1}',
        responseJson: '{"y":2}',
        success: true,
        createdAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
      },
      {
        id: freshId,
        requestTraceId: 'trace_fresh',
        appId: 'app_b',
        consumerKeyId: 'ck_b',
        requestedTargetName: 'model',
        resolvedTargetType: 'public_model',
        resolvedTargetId: 'pm_b',
        upstreamKeyId: 'uk_b',
        upstreamKeyName: 'Up',
        realModelName: 'real',
        promptJson: '{"x":3}',
        responseJson: '{"y":4}',
        success: true,
        createdAt: now,
      },
    ]);

    // Set retention to 30 days explicitly.
    await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { contentLogging: { enabled: true, retentionDays: 30, maxPayloadBytes: 1_000 } },
    });

    const { pruneContentLogs } = await import('../src/modules/observability/content-logs.js');
    const removed = await pruneContentLogs(rig.db, new Date(now.getTime() + 1));
    expect(removed).toBe(1);

    const remaining = await rig.db.select().from(contentLogs).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(freshId);
  });

  it('reports content logs removed in the maintenance pass', async () => {
    const now = new Date();
    await rig.db.insert(contentLogs).values({
      id: 'cl_maint_1',
      requestTraceId: 'trace_maint',
      appId: 'app_a',
      consumerKeyId: 'ck_a',
      requestedTargetName: 'model',
      resolvedTargetType: 'public_model',
      resolvedTargetId: 'pm_a',
      upstreamKeyId: 'uk_a',
      upstreamKeyName: 'Up',
      realModelName: 'real',
      promptJson: '{}',
      responseJson: '{}',
      success: true,
      createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    });

    await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { contentLogging: { enabled: true, retentionDays: 7, maxPayloadBytes: 1_000 } },
    });

    const { runMaintenancePass } = await import('../src/modules/jobs/index.js');
    const result = await runMaintenancePass(rig.db, now);
    expect(result.contentLogsRemoved).toBe(1);
  });
});

describe('content logging admin settings', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('returns content logging defaults and updates them', async () => {
    const get = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
    });
    expect(get.statusCode).toBe(200);
    const body = get.json() as { contentLogging: { enabled: boolean; retentionDays: number; maxPayloadBytes: number } };
    expect(body.contentLogging).toBeDefined();
    expect(typeof body.contentLogging.enabled).toBe('boolean');
    expect(typeof body.contentLogging.retentionDays).toBe('number');
    expect(typeof body.contentLogging.maxPayloadBytes).toBe('number');

    const put = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { contentLogging: { enabled: true, retentionDays: 14, maxPayloadBytes: 50_000 } },
    });
    expect(put.statusCode).toBe(200);
    const updated = put.json() as { contentLogging: { enabled: boolean; retentionDays: number; maxPayloadBytes: number } };
    expect(updated.contentLogging.enabled).toBe(true);
    expect(updated.contentLogging.retentionDays).toBe(14);
    expect(updated.contentLogging.maxPayloadBytes).toBe(50_000);
  });
});

async function adminCookie(rig: GatewayTestRig): Promise<string> {
  const login = await rig.app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { username: 'admin', password: 'secret123' },
  });
  expect(login.statusCode).toBe(200);
  const setCookie = login.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
  const cookie = cookies.find((c) => c && c.startsWith('mh_session='));
  expect(cookie).toBeDefined();
  return cookie as string;
}
