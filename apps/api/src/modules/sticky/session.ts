// Short-window session stickiness (M7.3).
//
// While `sticky_bindings` pins a conversation fingerprint to a candidate,
// `sticky_sessions` pins the looser tuple (consumerKeyId, requestedTargetName)
// for a short TTL (default 5 minutes). This reduces cross-channel switching
// overhead and improves upstream-side cache hit rates.
//
// Session sticky is intentionally weaker than conversation sticky:
//   * conversation-level sticky hit -> skip session sticky entirely.
//   * the bound candidate must still be a valid accepted candidate.
//   * TTL expiration or candidate unavailability silently falls back to normal
//     routing.

import { and, eq } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import {
  type Db,
  type StickySessionRow,
  type StickySessionInsert,
  stickySessions,
  upstreamKeys,
} from '../db/index.js';
import type { ResolvedCandidate } from '../router/candidates.js';

export const DEFAULT_SESSION_STICKY_TTL_MS = 5 * 60 * 1000;

export interface StickySessionLookupResult {
  binding: StickySessionRow | null;
  hit: boolean;
}

export interface StickySessionLookupInput {
  consumerKeyId: string;
  requestedTargetName: string;
  now: Date;
}

export async function lookupStickySession(
  db: Db,
  args: StickySessionLookupInput,
): Promise<StickySessionLookupResult> {
  const row = await db
    .select()
    .from(stickySessions)
    .where(
      and(
        eq(stickySessions.consumerKeyId, args.consumerKeyId),
        eq(stickySessions.requestedTargetName, args.requestedTargetName),
      ),
    )
    .get();
  if (!row) return { binding: null, hit: false };
  return { binding: row, hit: row.expiresAt.getTime() > args.now.getTime() };
}

export function isStickySessionValid(
  binding: StickySessionRow,
  accepted: ResolvedCandidate[],
  args: { now: Date },
): boolean {
  if (binding.expiresAt.getTime() <= args.now.getTime()) return false;
  const c = accepted.find(
    (x) => x.upstreamKeyId === binding.upstreamKeyId && x.realModelName === binding.realModelName,
  );
  if (!c) return false;
  if (!c.upstreamEnabled) return false;
  if (c.upstreamFrozen) return false;
  if (c.cooldownUntil instanceof Date && c.cooldownUntil.getTime() > args.now.getTime()) {
    return false;
  }
  return true;
}

export interface StickySessionUpsertInput {
  consumerKeyId: string;
  requestedTargetName: string;
  upstreamKeyId: string;
  realModelName: string;
  ttlMs: number;
  now: Date;
}

export async function upsertStickySession(
  db: Db,
  args: StickySessionUpsertInput,
): Promise<StickySessionRow | null> {
  try {
    const ttl = Math.max(1000, args.ttlMs);
    const existing = await db
      .select()
      .from(stickySessions)
      .where(
        and(
          eq(stickySessions.consumerKeyId, args.consumerKeyId),
          eq(stickySessions.requestedTargetName, args.requestedTargetName),
        ),
      )
      .get();
    const expires = new Date(args.now.getTime() + ttl);
    if (existing) {
      const newHit = existing.hitCount + 1;
      await db
        .update(stickySessions)
        .set({
          upstreamKeyId: args.upstreamKeyId,
          realModelName: args.realModelName,
          ttlMs: ttl,
          hitCount: newHit,
          lastUsedAt: args.now,
          expiresAt: expires,
          updatedAt: args.now,
        })
        .where(eq(stickySessions.id, existing.id));
      return {
        ...existing,
        upstreamKeyId: args.upstreamKeyId,
        realModelName: args.realModelName,
        ttlMs: ttl,
        hitCount: newHit,
        lastUsedAt: args.now,
        expiresAt: expires,
        updatedAt: args.now,
      };
    }
    const id = generateId('stickySession');
    const insert: StickySessionInsert = {
      id,
      consumerKeyId: args.consumerKeyId,
      requestedTargetName: args.requestedTargetName,
      upstreamKeyId: args.upstreamKeyId,
      realModelName: args.realModelName,
      ttlMs: ttl,
      hitCount: 1,
      lastUsedAt: args.now,
      expiresAt: expires,
      createdAt: args.now,
      updatedAt: args.now,
    };
    await db.insert(stickySessions).values(insert);
    return {
      id,
      consumerKeyId: args.consumerKeyId,
      requestedTargetName: args.requestedTargetName,
      upstreamKeyId: args.upstreamKeyId,
      realModelName: args.realModelName,
      ttlMs: ttl,
      hitCount: 1,
      lastUsedAt: args.now,
      expiresAt: expires,
      createdAt: args.now,
      updatedAt: args.now,
    };
  } catch {
    return null;
  }
}

export async function touchStickySession(
  db: Db,
  args: { id: string; ttlMs: number; now: Date },
): Promise<void> {
  try {
    const ttl = Math.max(1000, args.ttlMs);
    const existing = await db
      .select()
      .from(stickySessions)
      .where(eq(stickySessions.id, args.id))
      .get();
    if (!existing) return;
    await db
      .update(stickySessions)
      .set({
        hitCount: existing.hitCount + 1,
        lastUsedAt: args.now,
        expiresAt: new Date(args.now.getTime() + ttl),
        updatedAt: args.now,
      })
      .where(eq(stickySessions.id, args.id));
  } catch {
    /* ignore */
  }
}

export async function pruneExpiredStickySessions(db: Db, now: Date): Promise<number> {
  const all = await db.select().from(stickySessions).all();
  let removed = 0;
  for (const r of all) {
    if (r.expiresAt.getTime() <= now.getTime()) {
      try {
        await db.delete(stickySessions).where(eq(stickySessions.id, r.id));
        removed += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return removed;
}

export async function getStickySessionTtlMs(db: Db, upstreamKeyId: string): Promise<number> {
  try {
    const row = await db
      .select({ stickySessionTtlMs: upstreamKeys.stickySessionTtlMs })
      .from(upstreamKeys)
      .where(eq(upstreamKeys.id, upstreamKeyId))
      .get();
    return row?.stickySessionTtlMs ?? DEFAULT_SESSION_STICKY_TTL_MS;
  } catch {
    return DEFAULT_SESSION_STICKY_TTL_MS;
  }
}
