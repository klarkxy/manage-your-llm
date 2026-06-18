// Admin login rate limiting (post-M7 hardening).
//
// MVP policy: count failed attempts per (username + ip) over a rolling window;
// once the cap is hit, every login attempt for that pair returns 429 without
// invoking the password check. Successful logins reset the counter and are
// always allowed.

import { and, eq, gte, sql } from 'drizzle-orm';
import { generateId } from '@modelharbor/shared';
import { type Db, loginAttempts } from '../db/index.js';

export interface RateLimitOptions {
  windowMs: number;
  maxFailures: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxFailures: 10,
};

export interface RateLimitDecision {
  allowed: boolean;
  failuresInWindow: number;
  retryAfterMs: number;
}

export async function inspectLoginRateLimit(
  db: Db,
  args: { username: string; ip: string; now: Date; options?: RateLimitOptions },
): Promise<RateLimitDecision> {
  const options = args.options ?? DEFAULT_LOGIN_RATE_LIMIT;
  const since = new Date(args.now.getTime() - options.windowMs);
  const row = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.username, args.username),
        eq(loginAttempts.ip, args.ip),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, since),
      ),
    )
    .get();
  const failures = Number(row?.count ?? 0);
  if (failures >= options.maxFailures) {
    return {
      allowed: false,
      failuresInWindow: failures,
      retryAfterMs: options.windowMs,
    };
  }
  return { allowed: true, failuresInWindow: failures, retryAfterMs: 0 };
}

export async function recordLoginAttempt(
  db: Db,
  args: { username: string; ip: string; success: boolean; now?: Date },
): Promise<void> {
  try {
    await db.insert(loginAttempts).values({
      id: generateId('healthEvent'),
      username: args.username,
      ip: args.ip,
      success: args.success,
      createdAt: args.now ?? new Date(),
    });
  } catch {
    /* best-effort */
  }
}

export async function resetLoginFailures(
  db: Db,
  args: { username: string; ip: string },
): Promise<void> {
  try {
    await db
      .delete(loginAttempts)
      .where(
        and(
          eq(loginAttempts.username, args.username),
          eq(loginAttempts.ip, args.ip),
          eq(loginAttempts.success, false),
        ),
      );
  } catch {
    /* best-effort */
  }
}
