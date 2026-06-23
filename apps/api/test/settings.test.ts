import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeAdminRig, type AdminTestRig } from './helper.js';

describe('admin settings routes', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('GET /api/admin/settings returns defaults', async () => {
    const res = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.circuitBreaker).toBeTruthy();
    expect(body.endpointHealth).toBeTruthy();
    expect(body.contentLogging).toBeTruthy();
    expect(body.modelReference.autoPreset).toBe('balanced');
    expect(body.modelReference.autoTopN).toBe(5);
  });

  it('GET /api/admin/settings returns the publicEndpoints block with default /v1 prefix', async () => {
    const res = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.publicEndpoints.basePath).toBe('/v1');
    expect(typeof body.publicEndpoints.baseUrl).toBe('string');
    expect(body.publicEndpoints.endpoints.messages).toMatch(/\/v1\/messages$/);
    expect(body.publicEndpoints.endpoints.chatCompletions).toMatch(/\/v1\/chat\/completions$/);
    expect(body.publicEndpoints.endpoints.responses).toMatch(/\/v1\/responses$/);
    expect(body.publicEndpoints.endpoints.models).toMatch(/\/v1\/models$/);
  });

  it('PUT /api/admin/settings persists publicEndpoints.basePath and updates endpoint URLs', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { publicEndpoints: { basePath: '/api/v1/' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Trailing slash is stripped so the URLs don't end up with `//messages`.
    expect(body.publicEndpoints.basePath).toBe('/api/v1');
    expect(body.publicEndpoints.endpoints.messages).toMatch(/\/api\/v1\/messages$/);
    expect(body.publicEndpoints.endpoints.chatCompletions).toMatch(/\/api\/v1\/chat\/completions$/);

    // Round-trip: a follow-up GET should return the new prefix.
    const get = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().publicEndpoints.basePath).toBe('/api/v1');
  });

  it('PUT /api/admin/settings rejects publicEndpoints.basePath without a leading slash', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { publicEndpoints: { basePath: 'v1' } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.code).toBe('invalid_base_path');
    // The stored value should not have changed.
    const get = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
    });
    expect(get.json().publicEndpoints.basePath).toBe('/v1');
  });

  it('PUT /api/admin/settings updates circuit breaker knobs (clamped to floor)', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: {
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0, // clamped to 1
          baseCooldownMs: 10, // clamped to 1000
          maxCooldownMs: 5, // clamped to 1000
          halfOpenSuccessCount: 0, // clamped to 1
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.circuitBreaker.enabled).toBe(false);
    expect(body.circuitBreaker.failureThreshold).toBe(1);
    expect(body.circuitBreaker.baseCooldownMs).toBe(1000);
    expect(body.circuitBreaker.maxCooldownMs).toBe(1000);
    expect(body.circuitBreaker.halfOpenSuccessCount).toBe(1);
  });

  it('PUT /api/admin/settings updates endpoint health + streaming knobs', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: {
        endpointHealth: {
          probeEnabled: true,
          probeIntervalMs: 60_000,
          probeTimeoutMs: 1_000,
          degradedLatencyMs: 1_000,
        },
        streaming: { firstTokenTimeoutMs: 5000 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.endpointHealth.probeEnabled).toBe(true);
    expect(body.endpointHealth.probeIntervalMs).toBe(60_000);
    expect(body.streaming.firstTokenTimeoutMs).toBe(5000);
  });

  it('PUT /api/admin/settings updates content logging', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: {
        contentLogging: { enabled: true, retentionDays: 30, maxPayloadBytes: 4096 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contentLogging.enabled).toBe(true);
    expect(body.contentLogging.retentionDays).toBe(30);
    expect(body.contentLogging.maxPayloadBytes).toBe(4096);
  });

  it('PUT /api/admin/settings updates model reference preset/weights/topN', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: {
        modelReference: {
          autoPreset: 'code',
          autoWeights: { chat: 0.5, total: 0.5 },
          autoTopN: 10,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.modelReference.autoPreset).toBe('code');
    expect(body.modelReference.autoTopN).toBe(10);
    // Weights are normalized to sum to 1; just sanity-check shape.
    const weights = body.modelReference.autoWeights as Record<string, number>;
    expect(typeof weights.chat).toBe('number');
    expect(typeof weights.intelligence).toBe('number');
  });

  it('PUT /api/admin/settings rejects invalid autoPreset silently (keeps previous)', async () => {
    const res = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: {
        modelReference: { autoPreset: 'invalid-preset' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.modelReference.autoPreset).toBe('balanced');
  });

  it('PUT /api/admin/settings clamps autoTopN to [1, 20]', async () => {
    const tooBig = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { modelReference: { autoTopN: 999 } },
    });
    expect(tooBig.json().modelReference.autoTopN).toBe(20);

    const tooSmall = await rig.app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: rig.cookie },
      payload: { modelReference: { autoTopN: -5 } },
    });
    expect(tooSmall.json().modelReference.autoTopN).toBe(1);
  });

  it('GET /api/admin/circuit-breakers lists breakers and filters by state', async () => {
    const res = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/circuit-breakers',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('GET /api/admin/circuit-breakers with state=closed returns empty list', async () => {
    const res = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/circuit-breakers?state=closed',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });

  it('POST /api/admin/circuit-breakers/:id/reset returns 404 for unknown id', async () => {
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/circuit-breakers/cb_unknown/reset',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
