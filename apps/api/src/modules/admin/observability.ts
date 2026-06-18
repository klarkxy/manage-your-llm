// Admin routes for observability dashboards (M7).
//
// Surfaces the data the front-end Usage page needs: windowed totals,
// per-app / per-consumer-key / per-upstream / per-target breakdowns, and the
// most recent usage rows. The read endpoints are intentionally cheap (single
// SQL query per dimension) so the dashboard can poll every few seconds.

import type { FastifyInstance } from 'fastify';
import { type Db } from '../db/index.js';
import {
  getAppBreakdown,
  getConsumerKeyBreakdown,
  getRecentRequests,
  getTargetBreakdown,
  getTotalsForWindow,
  getUpstreamKeyBreakdown,
  todayWindow,
} from '../observability/index.js';

export interface ObservabilityRouteDeps {
  db: Db;
}

export interface TimeWindowQuery {
  window?: 'today' | '24h' | '7d';
}

function resolveWindow(args: TimeWindowQuery, now: Date) {
  if (args.window === '24h') {
    return { since: new Date(now.getTime() - 24 * 60 * 60 * 1000), until: now };
  }
  if (args.window === '7d') {
    return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), until: now };
  }
  return todayWindow(now);
}

export function registerObservabilityRoutes(
  app: FastifyInstance,
  deps: ObservabilityRouteDeps,
): void {
  const { db } = deps;

  app.get('/api/admin/usage/totals', async (req) => {
    const q = (req.query ?? {}) as TimeWindowQuery;
    const window = resolveWindow(q, new Date());
    return getTotalsForWindow(db, window);
  });

  app.get('/api/admin/usage/by-app', async (req) => {
    const q = (req.query ?? {}) as TimeWindowQuery;
    const window = resolveWindow(q, new Date());
    return { items: await getAppBreakdown(db, window) };
  });

  app.get('/api/admin/usage/by-consumer-key', async (req) => {
    const q = (req.query ?? {}) as TimeWindowQuery;
    const window = resolveWindow(q, new Date());
    return { items: await getConsumerKeyBreakdown(db, window) };
  });

  app.get('/api/admin/usage/by-upstream-key', async (req) => {
    const q = (req.query ?? {}) as TimeWindowQuery;
    const window = resolveWindow(q, new Date());
    return { items: await getUpstreamKeyBreakdown(db, window) };
  });

  app.get('/api/admin/usage/by-target', async (req) => {
    const q = (req.query ?? {}) as TimeWindowQuery;
    const window = resolveWindow(q, new Date());
    return { items: await getTargetBreakdown(db, window) };
  });

  app.get('/api/admin/usage/recent', async (req) => {
    const q = (req.query ?? {}) as { limit?: string };
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? '100') || 100));
    return { items: await getRecentRequests(db, { limit }) };
  });
}
