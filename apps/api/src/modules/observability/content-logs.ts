// Optional full prompt/response content logging (M6).
//
// Content logging is disabled by default and must be explicitly enabled by an
// administrator. When enabled, the gateway writes one row per successful
// request. The stored payload is redacted (API keys, consumer keys,
// Authorization headers) and truncated to a configurable max byte size before
// it ever hits the database. Rows are pruned after the configured retention
// period.

import { eq, lte } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import { type Db, adminSettings, contentLogs } from '../db/index.js';
import { redactValue } from './redaction.js';

export interface ContentLogSettings {
  enabled: boolean;
  retentionDays: number;
  maxPayloadBytes: number;
}

export interface ContentLogInput {
  requestTraceId?: string;
  appId: string;
  consumerKeyId: string;
  requestedTargetName: string;
  resolvedTargetType?: 'public_model' | 'model_group' | null;
  resolvedTargetId?: string | null;
  sourceProtocol?: string | null;
  upstreamKeyId: string;
  upstreamKeyName: string;
  realModelName: string;
  prompt: unknown;
  response: unknown;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  now?: Date;
}

const DEFAULT_SETTINGS: ContentLogSettings = {
  enabled: false,
  retentionDays: 7,
  maxPayloadBytes: 100_000,
};

const SETTINGS_ID = 'default';

export async function getContentLogSettings(db: Db): Promise<ContentLogSettings> {
  try {
    const row = await db.select().from(adminSettings).where(eq(adminSettings.id, SETTINGS_ID)).get();
    if (row) {
      return {
        enabled: row.contentLogEnabled,
        retentionDays: row.contentLogRetentionDays,
        maxPayloadBytes: row.contentLogMaxPayloadBytes,
      };
    }
  } catch {
    // fall back to defaults if the settings table is not yet available
  }
  return { ...DEFAULT_SETTINGS };
}

export async function writeContentLog(db: Db, input: ContentLogInput): Promise<void> {
  const settings = await getContentLogSettings(db);
  if (!settings.enabled) return;

  const now = input.now ?? new Date();
  const promptJson = serializeAndRedact(input.prompt, settings.maxPayloadBytes);
  const responseJson = serializeAndRedact(input.response, settings.maxPayloadBytes);

  try {
    await db.insert(contentLogs).values({
      id: generateId('contentLog'),
      requestTraceId: input.requestTraceId ?? null,
      appId: input.appId,
      consumerKeyId: input.consumerKeyId,
      requestedTargetName: input.requestedTargetName,
      resolvedTargetType: input.resolvedTargetType ?? null,
      resolvedTargetId: input.resolvedTargetId ?? null,
      sourceProtocol: input.sourceProtocol ?? null,
      upstreamKeyId: input.upstreamKeyId,
      upstreamKeyName: input.upstreamKeyName,
      realModelName: input.realModelName,
      promptJson,
      responseJson,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      createdAt: now,
    });
  } catch {
    // Content logging is best-effort; never let a storage failure break a
    // successful gateway response.
  }
}

export async function pruneContentLogs(db: Db, now: Date = new Date()): Promise<number> {
  const settings = await getContentLogSettings(db);
  const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - retentionMs);
  try {
    const rows = await db.select({ id: contentLogs.id }).from(contentLogs).where(lte(contentLogs.createdAt, cutoff)).all();
    let removed = 0;
    for (const row of rows) {
      try {
        await db.delete(contentLogs).where(eq(contentLogs.id, row.id));
        removed += 1;
      } catch {
        /* ignore */
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

function serializeAndRedact(value: unknown, maxBytes: number): string | null {
  const redacted = redactValue(value);
  let json: string;
  try {
    json = JSON.stringify(redacted);
  } catch {
    json = '[unserializable]';
  }
  const truncated = truncateToBytes(json, maxBytes);
  return truncated || null;
}

function truncateToBytes(input: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  const encoder = new TextEncoder();
  if (encoder.encode(input).length <= maxBytes) return input;
  let low = 0;
  let high = input.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (encoder.encode(input.slice(0, mid)).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${input.slice(0, low)}… [truncated]`;
}

