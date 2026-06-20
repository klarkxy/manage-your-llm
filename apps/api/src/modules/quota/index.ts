// Quota engine (M6).
//
// Tracks per-(upstream key, period) usage counters in `upstream_key_counters` and
// enforces the limits stored on `upstream_key_quotas`. The engine is intentionally
// simple: counters are persistent rows with an explicit `periodStartedAt` /
// `periodEndsAt` window, and the router engine calls `incrementAndCheck` once
// per gateway request after a candidate is selected. When a counter crosses a
// limit, the upstream key is frozen with reason `quota_exceeded:<dimension>`. A
// periodic jobs runner resets expired windows.
//
// We intentionally do NOT track RPM / TPM in this milestone (see
// docs/mvp.md): if the upstream rate-limits or reports quota exhaustion, the
// key enters cooldown. The counter engine is for the administrator's own
// spending cap, not for smoothing out upstream bursts.

import { and, eq, lte, sql } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import {
  type Db,
  type QuotaPeriod,
  type UpstreamKeyCounterRow,
  type UpstreamKeyQuotaRow,
  upstreamKeyCounters,
  upstreamKeyQuotas,
  upstreamKeys,
} from '../db/index.js';

export interface PeriodBounds {
  start: Date;
  end: Date;
}

// Compute the current period window for a given period kind at the given time.
// "total" never resets; the start is the Unix epoch and the end is far future.
// Other periods snap to the wall clock (UTC) so two requests inside the same
// hour always share a row.
export function periodBounds(period: QuotaPeriod, now: Date): PeriodBounds {
  if (period === 'total') {
    return { start: new Date(0), end: new Date(8.64e15) };
  }
  const ms = (PERIOD_MS as Record<string, number>)[period]!;
  const startMs = Math.floor(now.getTime() / ms) * ms;
  return { start: new Date(startMs), end: new Date(startMs + ms) };
}

const PERIOD_MS: Record<Exclude<QuotaPeriod, 'total'>, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

// Read the current counter for a (key, period) window, or null if no row exists
// yet. The caller decides whether to create one.
export async function getCurrentCounter(
  db: Db,
  args: { upstreamKeyId: string; period: QuotaPeriod; now: Date },
): Promise<UpstreamKeyCounterRow | null> {
  const { start } = periodBounds(args.period, args.now);
  const row = await db
    .select()
    .from(upstreamKeyCounters)
    .where(
      and(
        eq(upstreamKeyCounters.upstreamKeyId, args.upstreamKeyId),
        eq(upstreamKeyCounters.period, args.period),
        eq(upstreamKeyCounters.periodStartedAt, start),
      ),
    )
    .get();
  return row ?? null;
}

export interface QuotaUsageDelta {
  // Always +1. The request count is bumped regardless of the per-request token
  // usage so that request-only limits are still enforceable.
  requests: number;
  // Token counts are reported by the upstream response. Pass null when the
  // request failed before tokens were billed.
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface QuotaDecision {
  // The counter row after incrementing. May be a newly created row.
  counter: UpstreamKeyCounterRow;
  // True if the increment crossed a limit on the matching quota policy. The
  // caller should freeze the key and stop routing.
  overQuota: boolean;
  // The dimension that triggered the freeze, if any. Used for the freeze
  // reason and for debugging.
  overDimension: 'request' | 'input' | 'output' | 'total' | null;
}

// Atomically apply the usage delta to the current counter row, creating the
// row on first use of the period. Best-effort: callers can fire-and-forget.
// We never throw on persistence errors here.
export async function incrementAndCheck(
  db: Db,
  args: { upstreamKeyId: string; period: QuotaPeriod; delta: QuotaUsageDelta; now: Date },
): Promise<QuotaDecision | null> {
  try {
    const quota = await db
      .select()
      .from(upstreamKeyQuotas)
      .where(
        and(
          eq(upstreamKeyQuotas.upstreamKeyId, args.upstreamKeyId),
          eq(upstreamKeyQuotas.period, args.period),
        ),
      )
      .get();
    const counter = await incrementCounterAtomically(db, args);
    if (!counter) return null;
    if (!quota || !quota.enabled) {
      // No quota configured or quota disabled — still record usage so the
      // dashboard can see what was billed. Return the row without freezing.
      return { counter, overQuota: false, overDimension: null };
    }
    const newRequestCount = counter.requestCount;
    const newInput = counter.inputTokens;
    const newOutput = counter.outputTokens;
    const newTotal = counter.totalTokens;
    const overRequest = quota.requestLimit !== null && newRequestCount > quota.requestLimit;
    const overInput = quota.inputTokenLimit !== null && newInput > quota.inputTokenLimit;
    const overOutput = quota.outputTokenLimit !== null && newOutput > quota.outputTokenLimit;
    const overTotal = quota.totalTokenLimit !== null && newTotal > quota.totalTokenLimit;
    const overQuota = overRequest || overInput || overOutput || overTotal;
    const overDimension: QuotaDecision['overDimension'] = overRequest
      ? 'request'
      : overInput
        ? 'input'
        : overOutput
          ? 'output'
          : overTotal
            ? 'total'
            : null;

    return {
      counter,
      overQuota,
      overDimension,
    };
  } catch {
    return null;
  }
}

async function incrementCounterAtomically(
  db: Db,
  args: { upstreamKeyId: string; period: QuotaPeriod; delta: QuotaUsageDelta; now: Date },
): Promise<UpstreamKeyCounterRow | null> {
  const bounds = periodBounds(args.period, args.now);
  const id = generateId('upstreamKey') + '_c';
  const inputTokens = args.delta.inputTokens ?? 0;
  const outputTokens = args.delta.outputTokens ?? 0;
  const totalTokens = args.delta.totalTokens ?? 0;

  await db
    .insert(upstreamKeyCounters)
    .values({
      id,
      upstreamKeyId: args.upstreamKeyId,
      period: args.period,
      periodStartedAt: bounds.start,
      periodEndsAt: bounds.end,
      requestCount: args.delta.requests,
      inputTokens,
      outputTokens,
      totalTokens,
      createdAt: args.now,
      updatedAt: args.now,
    })
    .onConflictDoUpdate({
      target: [
        upstreamKeyCounters.upstreamKeyId,
        upstreamKeyCounters.period,
        upstreamKeyCounters.periodStartedAt,
      ],
      set: {
        requestCount: sql`${upstreamKeyCounters.requestCount} + ${args.delta.requests}`,
        inputTokens: sql`${upstreamKeyCounters.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${upstreamKeyCounters.outputTokens} + ${outputTokens}`,
        totalTokens: sql`${upstreamKeyCounters.totalTokens} + ${totalTokens}`,
        updatedAt: args.now,
      },
    });

  return await getCurrentCounter(db, {
    upstreamKeyId: args.upstreamKeyId,
    period: args.period,
    now: args.now,
  });
}

// Freeze the upstream key with a quota-specific reason. The router filter
// already drops frozen keys, so traffic immediately moves to the next candidate.
// The freeze is best-effort and never throws.
export async function freezeKeyForQuota(
  db: Db,
  args: {
    upstreamKeyId: string;
    dimension: 'request' | 'input' | 'output' | 'total';
    now: Date;
  },
): Promise<void> {
  try {
    await db
      .update(upstreamKeys)
      .set({
        frozen: true,
        frozenReason: `quota_exceeded:${args.dimension}`,
        updatedAt: args.now,
      })
      .where(eq(upstreamKeys.id, args.upstreamKeyId));
  } catch {
    /* ignore */
  }
}

// Read counters for a key across all configured periods. Used by the dashboard.
export async function getCountersForKey(
  db: Db,
  upstreamKeyId: string,
): Promise<UpstreamKeyCounterRow[]> {
  return await db
    .select()
    .from(upstreamKeyCounters)
    .where(eq(upstreamKeyCounters.upstreamKeyId, upstreamKeyId))
    .all();
}

// Drop counter rows whose window has already closed. Called periodically by the
// jobs runner. Returns the number of rows removed.
export async function getEnabledQuotaPeriods(
  db: Db,
  upstreamKeyId: string,
): Promise<QuotaPeriod[]> {
  const rows = await db
    .select({ period: upstreamKeyQuotas.period })
    .from(upstreamKeyQuotas)
    .where(
      and(eq(upstreamKeyQuotas.upstreamKeyId, upstreamKeyId), eq(upstreamKeyQuotas.enabled, true)),
    )
    .all();
  return rows.map((r) => r.period);
}

// Apply the usage delta to every configured quota period for the upstream key
// (plus the running `total` counter so the dashboard always sees lifetime
// usage). The matching period freezes the key as soon as the next bump would
// cross its limit. Best-effort: never throws.
export async function recordQuotaUsage(
  db: Db,
  args: {
    upstreamKeyId: string;
    delta: QuotaUsageDelta;
    periods: QuotaPeriod[];
    now: Date;
  },
): Promise<void> {
  // Always bump `total` so the dashboard can show lifetime usage even when
  // no total-quota row is configured. Incrementing a missing row is harmless
  // because `incrementAndCheck` falls through to `incrementOnly` and still
  // writes a counter row.
  const periods: QuotaPeriod[] = args.periods.includes('total')
    ? args.periods
    : [...args.periods, 'total'];
  for (const period of periods) {
    const decision = await incrementAndCheck(db, {
      upstreamKeyId: args.upstreamKeyId,
      period,
      delta: args.delta,
      now: args.now,
    });
    if (decision?.overQuota && decision.overDimension) {
      await freezeKeyForQuota(db, {
        upstreamKeyId: args.upstreamKeyId,
        dimension: decision.overDimension,
        now: args.now,
      });
    }
  }
}

export async function resetExpiredCounters(db: Db, now: Date): Promise<number> {
  let total = 0;
  const expired = await db
    .select()
    .from(upstreamKeyCounters)
    .where(lte(upstreamKeyCounters.periodEndsAt, now))
    .all();
  for (const r of expired) {
    if (r.period === 'total') continue;
    try {
      await db.delete(upstreamKeyCounters).where(eq(upstreamKeyCounters.id, r.id));
      total += 1;
    } catch {
      /* ignore */
    }
  }
  // Safety net: any counter whose periodStartedAt is not aligned with the
  // current window for its period is stale and should be removed.
  const all = await db.select().from(upstreamKeyCounters).all();
  for (const r of all) {
    if (r.period === 'total') continue;
    const expected = periodBounds(r.period, now).start;
    if (r.periodStartedAt.getTime() !== expected.getTime()) {
      try {
        await db.delete(upstreamKeyCounters).where(eq(upstreamKeyCounters.id, r.id));
        total += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

// Return true when any configured quota limit on this upstream key would be
// exceeded if the given delta were applied. Used by the candidate filter to
// drop over-quota keys without a DB write.
export async function wouldExceedQuota(
  db: Db,
  args: { upstreamKeyId: string; delta: QuotaUsageDelta; now: Date },
): Promise<boolean> {
  const quotas: UpstreamKeyQuotaRow[] = await db
    .select()
    .from(upstreamKeyQuotas)
    .where(eq(upstreamKeyQuotas.upstreamKeyId, args.upstreamKeyId))
    .all();
  for (const q of quotas) {
    if (!q.enabled) continue;
    const counter = await getCurrentCounter(db, {
      upstreamKeyId: args.upstreamKeyId,
      period: q.period,
      now: args.now,
    });
    const reqs = (counter?.requestCount ?? 0) + args.delta.requests;
    const ins = (counter?.inputTokens ?? 0) + (args.delta.inputTokens ?? 0);
    const outs = (counter?.outputTokens ?? 0) + (args.delta.outputTokens ?? 0);
    const tot = (counter?.totalTokens ?? 0) + (args.delta.totalTokens ?? 0);
    if (q.requestLimit !== null && reqs > q.requestLimit) return true;
    if (q.inputTokenLimit !== null && ins > q.inputTokenLimit) return true;
    if (q.outputTokenLimit !== null && outs > q.outputTokenLimit) return true;
    if (q.totalTokenLimit !== null && tot > q.totalTokenLimit) return true;
  }
  return false;
}
