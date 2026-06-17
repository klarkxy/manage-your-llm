import { eq } from "drizzle-orm";
import { type Db, upstreamKeys } from "../db/index.js";
import type { NormalizedProviderError } from "../providers/types.js";

// Cooldown durations applied when the upstream reports the matching error
// category. M4 only reacts to upstream signals (no proactive quota counters
// yet — that lands in M6). The user's M4 brief says: if upstream rate-limits
// or reports quota exhaustion, the key goes into cooldown; the router will
// then pick a different candidate from the same group on the next request.
const COOLDOWN_MS: Record<string, number> = {
  provider_rate_limit: 60_000,
  provider_quota: 5 * 60_000,
  provider_overloaded: 30_000,
  provider_timeout: 15_000,
};

export interface CooldownUpdate {
  cooldownUntil: Date | null;
  lastErrorCode: string;
  lastErrorMessage: string;
}

export function shouldCooldown(category: NormalizedProviderError["category"]): boolean {
  return Object.prototype.hasOwnProperty.call(COOLDOWN_MS, category);
}

export function computeCooldownUpdate(
  category: NormalizedProviderError["category"],
  providerCode: string | null,
  providerMessage: string | null,
  now: Date,
): CooldownUpdate {
  const ms = COOLDOWN_MS[category] ?? 0;
  return {
    cooldownUntil: ms > 0 ? new Date(now.getTime() + ms) : null,
    lastErrorCode: providerCode ?? category,
    lastErrorMessage: providerMessage ?? "",
  };
}

// Persist the cooldown and the last error info on the upstream key row. Best
// effort: callers can fire-and-forget. We never throw from this path.
export async function applyCooldown(
  db: Db,
  args: {
    upstreamKeyId: string;
    update: CooldownUpdate;
  },
): Promise<void> {
  const set: Partial<typeof upstreamKeys.$inferInsert> = {
    lastErrorCode: args.update.lastErrorCode,
    lastErrorMessage: args.update.lastErrorMessage,
    updatedAt: new Date(),
  };
  if (args.update.cooldownUntil) {
    set.cooldownUntil = args.update.cooldownUntil;
  }
  await db.update(upstreamKeys).set(set).where(eq(upstreamKeys.id, args.upstreamKeyId));
}
