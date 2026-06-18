// Usage aggregation (M7 dashboard).
//
// Computes the dashboard cards and tables from `usage_records`. The
// aggregation is deliberately kept simple: a single SQL query per dimension
// grouped by the right id, summed for tokens and counts. SQLite handles the
// indexed range scan (created_at has an index) without any extra help.

import { and, count, eq, gte, sql } from 'drizzle-orm';
import {
  type Db,
  type UsageRecordRow,
  apps,
  consumerKeys,
  publicModels,
  modelGroups,
  upstreamKeys,
  usageRecords,
} from '../db/index.js';

export interface TimeWindow {
  since: Date;
  until: Date;
}

export function todayWindow(now: Date): TimeWindow {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return { since: start, until: now };
}

export interface TotalsCard {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  stickyHits: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  successRate: number;
  stickyHitRate: number;
}

export async function getTotalsForWindow(db: Db, window: TimeWindow): Promise<TotalsCard> {
  const row = await db
    .select({
      total: count(),
      successes: sql<number>`SUM(CASE WHEN ${usageRecords.status} = 'success' THEN 1 ELSE 0 END)`,
      failures: sql<number>`SUM(CASE WHEN ${usageRecords.status} = 'error' THEN 1 ELSE 0 END)`,
      stickyHits: sql<number>`SUM(CASE WHEN ${usageRecords.stickyHit} = 1 THEN 1 ELSE 0 END)`,
      input: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)`,
      output: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${usageRecords.totalTokens}), 0)`,
    })
    .from(usageRecords)
    .where(
      and(
        gte(usageRecords.createdAt, window.since),
        sql`${usageRecords.createdAt} <= ${window.until}`,
      ),
    )
    .get();
  const total = Number(row?.total ?? 0);
  const successes = Number(row?.successes ?? 0);
  const failures = Number(row?.failures ?? 0);
  const stickyHits = Number(row?.stickyHits ?? 0);
  return {
    totalRequests: total,
    successfulRequests: successes,
    failedRequests: failures,
    stickyHits,
    inputTokens: Number(row?.input ?? 0),
    outputTokens: Number(row?.output ?? 0),
    totalTokens: Number(row?.totalTokens ?? 0),
    successRate: total === 0 ? 0 : successes / total,
    stickyHitRate: total === 0 ? 0 : stickyHits / total,
  };
}

export interface BreakdownEntry {
  id: string;
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

async function breakdown(
  db: Db,
  args: {
    idColumn:
      | typeof usageRecords.appId
      | typeof usageRecords.consumerKeyId
      | typeof usageRecords.upstreamKeyId;
    nameTable: typeof apps | typeof consumerKeys | typeof upstreamKeys;
    nameColumn: typeof apps.id | typeof consumerKeys.id | typeof upstreamKeys.id;
    window: TimeWindow;
  },
): Promise<BreakdownEntry[]> {
  const rows = await db
    .select({
      id: args.idColumn,
      name: args.nameTable.name,
      total: count(),
      successes: sql<number>`SUM(CASE WHEN ${usageRecords.status} = 'success' THEN 1 ELSE 0 END)`,
      failures: sql<number>`SUM(CASE WHEN ${usageRecords.status} = 'error' THEN 1 ELSE 0 END)`,
      input: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)`,
      output: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${usageRecords.totalTokens}), 0)`,
    })
    .from(usageRecords)
    .innerJoin(args.nameTable, eq(args.idColumn, args.nameColumn))
    .where(
      and(
        gte(usageRecords.createdAt, args.window.since),
        sql`${usageRecords.createdAt} <= ${args.window.until}`,
      ),
    )
    .groupBy(args.idColumn, args.nameTable.name)
    .all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    totalRequests: Number(row.total),
    successfulRequests: Number(row.successes),
    failedRequests: Number(row.failures),
    inputTokens: Number(row.input),
    outputTokens: Number(row.output),
    totalTokens: Number(row.totalTokens),
  }));
}

export async function getAppBreakdown(db: Db, window: TimeWindow): Promise<BreakdownEntry[]> {
  return breakdown(db, {
    idColumn: usageRecords.appId,
    nameTable: apps,
    nameColumn: apps.id,
    window,
  });
}

export async function getConsumerKeyBreakdown(
  db: Db,
  window: TimeWindow,
): Promise<BreakdownEntry[]> {
  return breakdown(db, {
    idColumn: usageRecords.consumerKeyId,
    nameTable: consumerKeys,
    nameColumn: consumerKeys.id,
    window,
  });
}

export async function getUpstreamKeyBreakdown(
  db: Db,
  window: TimeWindow,
): Promise<BreakdownEntry[]> {
  return breakdown(db, {
    idColumn: usageRecords.upstreamKeyId,
    nameTable: upstreamKeys,
    nameColumn: upstreamKeys.id,
    window,
  });
}

export interface TargetBreakdownEntry extends BreakdownEntry {
  targetType: 'public_model' | 'model_group';
}

export async function getTargetBreakdown(
  db: Db,
  window: TimeWindow,
): Promise<TargetBreakdownEntry[]> {
  const rows = await db
    .select({
      id: usageRecords.resolvedTargetId,
      targetType: usageRecords.resolvedTargetType,
      total: count(),
      successes: sql<number>`SUM(CASE WHEN ${usageRecords.status} = 'success' THEN 1 ELSE 0 END)`,
      failures: sql<number>`SUM(CASE WHEN ${usageRecords.status} = 'error' THEN 1 ELSE 0 END)`,
      input: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)`,
      output: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${usageRecords.totalTokens}), 0)`,
    })
    .from(usageRecords)
    .where(
      and(
        gte(usageRecords.createdAt, window.since),
        sql`${usageRecords.createdAt} <= ${window.until}`,
      ),
    )
    .groupBy(usageRecords.resolvedTargetId, usageRecords.resolvedTargetType)
    .all();
  if (rows.length === 0) return [];
  // Resolve target names from the namespace table. Public model and model
  // group ids come from different tables; do one query per kind.
  const pmIds = rows.filter((r) => r.targetType === 'public_model').map((r) => r.id);
  const mgIds = rows.filter((r) => r.targetType === 'model_group').map((r) => r.id);
  const pmRows = pmIds.length > 0 ? await db.select().from(publicModels).all() : [];
  const mgRows = mgIds.length > 0 ? await db.select().from(modelGroups).all() : [];
  const pmName = new Map(pmRows.map((p) => [p.id, p.name]));
  const mgName = new Map(mgRows.map((p) => [p.id, p.name]));
  return rows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    name:
      row.targetType === 'public_model'
        ? (pmName.get(row.id) ?? row.id)
        : (mgName.get(row.id) ?? row.id),
    totalRequests: Number(row.total),
    successfulRequests: Number(row.successes),
    failedRequests: Number(row.failures),
    inputTokens: Number(row.input),
    outputTokens: Number(row.output),
    totalTokens: Number(row.totalTokens),
  }));
}

export interface RecentRequest {
  id: string;
  appId: string;
  consumerKeyId: string;
  requestedTargetName: string;
  resolvedTargetType: string;
  resolvedTargetId: string;
  upstreamKeyId: string;
  realModelName: string;
  sourceProtocol: string;
  stream: boolean;
  stickyHit: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  status: string;
  errorCode: string | null;
  latencyMs: number;
  createdAt: Date;
}

export async function getRecentRequests(
  db: Db,
  args: { limit: number },
): Promise<UsageRecordRow[]> {
  return await db
    .select()
    .from(usageRecords)
    .orderBy(sql`${usageRecords.createdAt} DESC`)
    .limit(args.limit)
    .all();
}
