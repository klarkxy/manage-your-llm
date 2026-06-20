import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import {
  type UpstreamKeyQuotaRow,
  upstreamKeyQuotas,
  upstreamKeys,
} from '../src/modules/db/index.js';
import { encryptUpstreamApiKey } from '../src/modules/admin/index.js';
import {
  freezeKeyForQuota,
  getCountersForKey,
  getCurrentCounter,
  getEnabledQuotaPeriods,
  incrementAndCheck,
  periodBounds,
  recordQuotaUsage,
  resetExpiredCounters,
  wouldExceedQuota,
} from '../src/modules/quota/index.js';
import { makeAdminRig, type AdminTestRig } from './helper.js';

async function seedUpstreamKey(rig: AdminTestRig, name = 'uk1'): Promise<{ id: string }> {
  const now = new Date();
  const id = generateId('upstreamKey');
  const enc = encryptUpstreamApiKey('sk-test', rig.secretKey);
  await rig.db.insert(upstreamKeys).values({
    id,
    name,
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

async function setQuota(
  rig: AdminTestRig,
  args: {
    upstreamKeyId: string;
    period: 'hour' | 'day' | 'week' | 'month' | 'total';
    requestLimit?: number;
    inputTokenLimit?: number;
  },
): Promise<UpstreamKeyQuotaRow> {
  const now = new Date();
  const row: UpstreamKeyQuotaRow = {
    id: generateId('upstreamKey') + '_q',
    upstreamKeyId: args.upstreamKeyId,
    period: args.period,
    requestLimit: args.requestLimit ?? null,
    inputTokenLimit: args.inputTokenLimit ?? null,
    outputTokenLimit: null,
    totalTokenLimit: null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  await rig.db.insert(upstreamKeyQuotas).values(row);
  return row;
}

describe('quota: period math', () => {
  it('hour bounds snap to the wall clock', () => {
    const now = new Date('2025-06-16T12:34:56.789Z');
    const { start, end } = periodBounds('hour', now);
    expect(start.toISOString()).toBe('2025-06-16T12:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it('day bounds snap to UTC midnight', () => {
    const now = new Date('2025-06-16T12:34:56.789Z');
    const { start, end } = periodBounds('day', now);
    expect(start.toISOString()).toBe('2025-06-16T00:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('total has no realistic end', () => {
    const now = new Date('2025-06-16T12:00:00.000Z');
    const { start, end } = periodBounds('total', now);
    expect(start.getTime()).toBe(0);
    expect(end.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('quota: incrementAndCheck', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('creates a counter on first call and does not freeze under the limit', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 10 });
    const decision = await incrementAndCheck(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      delta: { requests: 1, inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      now: new Date(),
    });
    expect(decision).not.toBeNull();
    expect(decision?.overQuota).toBe(false);
    expect(decision?.overDimension).toBeNull();
    expect(decision?.counter.requestCount).toBe(1);
    expect(decision?.counter.totalTokens).toBe(300);
  });

  it('freezes the upstream key when the request limit is exceeded', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 2 });
    await incrementAndCheck(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      delta: { requests: 2, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now: new Date(),
    });
    const decision = await incrementAndCheck(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      delta: { requests: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now: new Date(),
    });
    expect(decision?.overQuota).toBe(true);
    expect(decision?.overDimension).toBe('request');
    await freezeKeyForQuota(rig.db, { upstreamKeyId: id, dimension: 'request', now: new Date() });
    const row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    expect(row?.frozen).toBe(true);
    expect(row?.frozenReason).toBe('quota_exceeded:request');
  });

  it('freezes on input token limit when crossed', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', inputTokenLimit: 100 });
    const decision = await incrementAndCheck(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      delta: { requests: 1, inputTokens: 200, outputTokens: 0, totalTokens: 200 },
      now: new Date(),
    });
    expect(decision?.overQuota).toBe(true);
    expect(decision?.overDimension).toBe('input');
  });

  it('records usage even when no quota is configured', async () => {
    const { id } = await seedUpstreamKey(rig);
    // No quota row.
    const decision = await incrementAndCheck(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      delta: { requests: 1, inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      now: new Date(),
    });
    expect(decision).not.toBeNull();
    expect(decision?.overQuota).toBe(false);
    const counters = await getCountersForKey(rig.db, id);
    expect(counters.length).toBe(1);
    expect(counters[0]?.requestCount).toBe(1);
  });

  it('skips a disabled quota and never freezes', async () => {
    const { id } = await seedUpstreamKey(rig);
    const q = await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 1 });
    await rig.db
      .update(upstreamKeyQuotas)
      .set({ enabled: false })
      .where(eq(upstreamKeyQuotas.id, q.id));
    for (let i = 0; i < 5; i++) {
      const d = await incrementAndCheck(rig.db, {
        upstreamKeyId: id,
        period: 'total',
        delta: { requests: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        now: new Date(),
      });
      expect(d?.overQuota).toBe(false);
    }
  });

  it('uses the current counter for repeated calls in the same window', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 100 });
    for (let i = 0; i < 3; i++) {
      await incrementAndCheck(rig.db, {
        upstreamKeyId: id,
        period: 'total',
        delta: { requests: 1, inputTokens: 10, outputTokens: 0, totalTokens: 10 },
        now: new Date(),
      });
    }
    const counter = await getCurrentCounter(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      now: new Date(),
    });
    expect(counter?.requestCount).toBe(3);
    expect(counter?.inputTokens).toBe(30);
  });

  it('does not lose increments from concurrent calls', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 100 });
    const now = new Date();

    await Promise.all(
      Array.from({ length: 20 }, () =>
        incrementAndCheck(rig.db, {
          upstreamKeyId: id,
          period: 'total',
          delta: { requests: 1, inputTokens: 2, outputTokens: 3, totalTokens: 5 },
          now,
        }),
      ),
    );

    const counter = await getCurrentCounter(rig.db, {
      upstreamKeyId: id,
      period: 'total',
      now,
    });
    expect(counter?.requestCount).toBe(20);
    expect(counter?.inputTokens).toBe(40);
    expect(counter?.outputTokens).toBe(60);
    expect(counter?.totalTokens).toBe(100);
  });
});

describe('quota: wouldExceedQuota', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('returns false when under the limit', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 10 });
    const over = await wouldExceedQuota(rig.db, {
      upstreamKeyId: id,
      delta: { requests: 5, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now: new Date(),
    });
    expect(over).toBe(false);
  });

  it('returns true when the next call would exceed the limit', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'total', requestLimit: 1 });
    const over = await wouldExceedQuota(rig.db, {
      upstreamKeyId: id,
      delta: { requests: 2, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now: new Date(),
    });
    expect(over).toBe(true);
  });
});

describe('quota: resetExpiredCounters', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('removes counters whose window has ended', async () => {
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'hour', requestLimit: 10 });
    // First call: row is created for the *current* hour.
    const now = new Date();
    await incrementAndCheck(rig.db, {
      upstreamKeyId: id,
      period: 'hour',
      delta: { requests: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now,
    });
    // Pretend we're a week later.
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const removed = await resetExpiredCounters(rig.db, later);
    expect(removed).toBeGreaterThanOrEqual(1);
    const remaining = await getCountersForKey(rig.db, id);
    expect(remaining.length).toBe(0);
  });
});

describe('quota: recordQuotaUsage (configured period + total)', () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it('bumps the configured period and the running total', async () => {
    // The schema allows at most one quota row per upstream key, so we set
    // a single `hour` quota and verify both that counter and the running
    // `total` counter get bumped on a successful request.
    const { id } = await seedUpstreamKey(rig);
    await setQuota(rig, { upstreamKeyId: id, period: 'hour', requestLimit: 1000 });

    const periods = await getEnabledQuotaPeriods(rig.db, id);
    expect(periods).toEqual(['hour']);

    const now = new Date();
    await recordQuotaUsage(rig.db, {
      upstreamKeyId: id,
      periods,
      delta: { requests: 1, inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      now,
    });

    const counters = await getCountersForKey(rig.db, id);
    const byPeriod = new Map(counters.map((c) => [c.period, c]));
    expect(byPeriod.get('hour')?.requestCount).toBe(1);
    expect(byPeriod.get('hour')?.totalTokens).toBe(30);
    // `recordQuotaUsage` always bumps the running `total` so the dashboard
    // can show lifetime usage even when no `total` quota row is configured.
    expect(byPeriod.get('total')?.requestCount).toBe(1);
    expect(byPeriod.get('total')?.totalTokens).toBe(30);
  });

  it('freezes the key when the configured (non-total) period crosses its limit', async () => {
    const { id } = await seedUpstreamKey(rig);
    // 2 requests per hour is the cap. We don't set a `total` quota.
    await setQuota(rig, { upstreamKeyId: id, period: 'hour', requestLimit: 2 });

    const periods = await getEnabledQuotaPeriods(rig.db, id);
    const now = new Date();
    // First request: under the cap, no freeze.
    await recordQuotaUsage(rig.db, {
      upstreamKeyId: id,
      periods,
      delta: { requests: 2, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now,
    });
    let row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    expect(row?.frozen).toBe(false);

    // Second bump: pushes the hour counter to 4, well over the cap of 2,
    // so the helper freezes the key with reason quota_exceeded:request.
    await recordQuotaUsage(rig.db, {
      upstreamKeyId: id,
      periods,
      delta: { requests: 2, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now,
    });
    row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    expect(row?.frozen).toBe(true);
    expect(row?.frozenReason).toBe('quota_exceeded:request');

    // wouldExceedQuota now sees the real hour usage (not a stale 0), so
    // wouldExceedQuota would have correctly dropped the key on the next
    // routing call.
    const over = await wouldExceedQuota(rig.db, {
      upstreamKeyId: id,
      delta: { requests: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      now,
    });
    expect(over).toBe(true);
  });

  it('still bumps the running total when no quota is configured at all', async () => {
    const { id } = await seedUpstreamKey(rig);
    // No quota row for this key.
    const periods = await getEnabledQuotaPeriods(rig.db, id);
    expect(periods).toEqual([]);

    await recordQuotaUsage(rig.db, {
      upstreamKeyId: id,
      periods,
      delta: { requests: 1, inputTokens: 5, outputTokens: 7, totalTokens: 12 },
      now: new Date(),
    });

    const counters = await getCountersForKey(rig.db, id);
    const total = counters.find((c) => c.period === 'total');
    expect(total?.requestCount).toBe(1);
    expect(total?.totalTokens).toBe(12);
  });
});
