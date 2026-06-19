import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { upstreamKeys, upstreamEndpointHealth } from '../src/modules/db/index.js';
import { makeAdminRig, type AdminTestRig } from './helper.js';
import {
  listEndpointTargetsForKey,
  runEndpointHealthProbe,
  sortCandidatesByLatency,
} from '../src/modules/upstream/endpoint-health.js';

const originalFetch = globalThis.fetch;

describe('upstream endpoint health', () => {
  let rig: AdminTestRig;

  beforeEach(async () => {
    rig = await makeAdminRig();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rig.close();
  });

  async function createKey(payload: {
    name: string;
    providerType: 'anthropic_compatible' | 'openai_compatible';
    baseUrl: string;
    apiKey: string;
    endpoints?: Array<{ protocol: string; baseUrl: string; providerType: string }>;
  }): Promise<string> {
    const res = await rig.app.inject({
      method: 'POST',
      url: '/api/admin/upstream-keys',
      headers: { cookie: rig.cookie },
      payload,
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { id: string }).id;
  }

  it('lists one endpoint target for a single-endpoint key', async () => {
    const id = await createKey({
      name: 'single',
      providerType: 'anthropic_compatible',
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test',
    });
    const row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    const targets = listEndpointTargetsForKey(row!);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ upstreamKeyId: id, baseUrl: 'https://api.example.com' });
  });

  it('lists distinct endpoint targets from endpointsJson', async () => {
    const id = await createKey({
      name: 'multi',
      providerType: 'anthropic_compatible',
      baseUrl: 'https://legacy.example.com',
      apiKey: 'sk-test',
      endpoints: [
        { protocol: 'anthropic', baseUrl: 'https://anthropic.example.com', providerType: 'anthropic_compatible' },
        { protocol: 'openai', baseUrl: 'https://openai.example.com', providerType: 'openai_compatible' },
        { protocol: 'openai', baseUrl: 'https://openai.example.com', providerType: 'openai_compatible' },
      ],
    });
    const row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    const targets = listEndpointTargetsForKey(row!);
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.baseUrl).sort()).toEqual([
      'https://anthropic.example.com',
      'https://openai.example.com',
    ]);
  });

  it('probes enabled keys and stores delay/degraded state', async () => {
    await createKey({
      name: 'healthy',
      providerType: 'anthropic_compatible',
      baseUrl: 'https://healthy.example.com',
      apiKey: 'sk-test',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200 } as Response),
    );

    const summary = await runEndpointHealthProbe(rig.db, rig.secretKey);
    expect(summary.checked).toBe(1);
    expect(summary.degraded).toBe(0);

    const rows = await rig.db.select().from(upstreamEndpointHealth).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      endpointBaseUrl: 'https://healthy.example.com',
      degraded: false,
      errorCode: null,
    });
    expect(typeof rows[0].delayMs).toBe('number');
  });

  it('marks an endpoint degraded when it returns a 5xx', async () => {
    await createKey({
      name: 'unhealthy',
      providerType: 'anthropic_compatible',
      baseUrl: 'https://unhealthy.example.com',
      apiKey: 'sk-test',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 503 } as Response),
    );

    const summary = await runEndpointHealthProbe(rig.db, rig.secretKey);
    expect(summary.checked).toBe(1);
    expect(summary.degraded).toBe(1);

    const row = await rig.db.select().from(upstreamEndpointHealth).get();
    expect(row).toMatchObject({
      degraded: true,
      errorCode: 'HTTP_503',
    });
  });

  it('marks an endpoint degraded on transport failure', async () => {
    await createKey({
      name: 'down',
      providerType: 'anthropic_compatible',
      baseUrl: 'https://down.example.com',
      apiKey: 'sk-test',
    });

    const error = new TypeError('fetch failed');
    (error as { name: string }).name = 'TypeError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));

    const summary = await runEndpointHealthProbe(rig.db, rig.secretKey);
    expect(summary.checked).toBe(1);
    expect(summary.degraded).toBe(1);

    const row = await rig.db.select().from(upstreamEndpointHealth).get();
    expect(row).toMatchObject({
      degraded: true,
      delayMs: null,
    });
    expect(row?.errorMessage).toContain('fetch failed');
  });

  it('exposes endpoint health via the admin API', async () => {
    const id = await createKey({
      name: 'api',
      providerType: 'anthropic_compatible',
      baseUrl: 'https://api-health.example.com',
      apiKey: 'sk-test',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200 } as Response),
    );
    await runEndpointHealthProbe(rig.db, rig.secretKey);

    const res = await rig.app.inject({
      method: 'GET',
      url: '/api/admin/upstream-endpoint-health',
      headers: { cookie: rig.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ upstreamKeyId: string; endpointBaseUrl: string; degraded: boolean }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      upstreamKeyId: id,
      endpointBaseUrl: 'https://api-health.example.com',
      degraded: false,
    });

    const filtered = await rig.app.inject({
      method: 'GET',
      url: `/api/admin/upstream-endpoint-health?upstreamKeyId=${id}`,
      headers: { cookie: rig.cookie },
    });
    expect(filtered.json()).toEqual(body);
  });

  it('sorts candidates by degraded=false then delay ascending', () => {
    const candidates = [
      { upstreamKeyId: 'a', endpointBaseUrl: 'https://a', priority: 1, weight: 1 },
      { upstreamKeyId: 'b', endpointBaseUrl: 'https://b', priority: 1, weight: 1 },
      { upstreamKeyId: 'c', endpointBaseUrl: 'https://c', priority: 1, weight: 1 },
    ];
    const health = [
      { id: 'h1', upstreamKeyId: 'a', endpointBaseUrl: 'https://a', delayMs: 100, lastCheckedAt: new Date(), degraded: false, errorCode: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'h2', upstreamKeyId: 'b', endpointBaseUrl: 'https://b', delayMs: 50, lastCheckedAt: new Date(), degraded: false, errorCode: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'h3', upstreamKeyId: 'c', endpointBaseUrl: 'https://c', delayMs: 10, lastCheckedAt: new Date(), degraded: true, errorCode: 'HTTP_500', errorMessage: 'down', createdAt: new Date(), updatedAt: new Date() },
    ];
    const sorted = sortCandidatesByLatency(candidates, health);
    expect(sorted.map((c) => c.upstreamKeyId)).toEqual(['b', 'a', 'c']);
  });

  it('falls back to priority and weight when no health row exists', () => {
    const candidates = [
      { upstreamKeyId: 'a', endpointBaseUrl: 'https://a', priority: 2, weight: 5 },
      { upstreamKeyId: 'b', endpointBaseUrl: 'https://b', priority: 1, weight: 1 },
    ];
    const sorted = sortCandidatesByLatency(candidates, []);
    expect(sorted.map((c) => c.upstreamKeyId)).toEqual(['b', 'a']);
  });
});
