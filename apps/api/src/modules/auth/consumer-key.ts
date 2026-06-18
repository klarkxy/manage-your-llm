import { eq, and, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  type AppRow,
  type ConsumerKeyAccessRow,
  type ConsumerKeyRow,
  type Db,
  apps,
  consumerKeyAccess,
  consumerKeys,
} from '../db/index.js';
import { AuthenticationError, PermissionError } from '@modelharbor/shared';
import { hashSessionId } from './session.js';

export interface AuthenticatedConsumerRequest extends FastifyRequest {
  consumerKey: ConsumerKeyRow;
  app: AppRow;
}

// Extract the raw consumer key from gateway request headers.
// - Authorization: Bearer mh_... (preferred)
// - x-api-key: mh_... (Anthropic SDK style)
//
// Returns the raw key (or null if neither header is present). The caller is
// responsible for hashing + looking it up.
export function extractRawConsumerKey(req: FastifyRequest): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.length > 0) {
    const trimmed = auth.trim();
    const match = /^Bearer\s+(.+)$/i.exec(trimmed);
    if (match) return match[1]!.trim();
    // Some clients send the raw key without the `Bearer ` prefix. Accept it as
    // long as it starts with the documented prefix `mh_`.
    if (trimmed.startsWith('mh_')) return trimmed;
  }
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.length > 0) {
    return xApiKey.trim();
  }
  return null;
}

// Look up an active consumer key by its raw value. Returns null if no active
// row matches (wrong key, disabled, or revoked).
export async function findActiveConsumerKey(
  db: Db,
  rawKey: string,
): Promise<{ key: ConsumerKeyRow; app: AppRow } | null> {
  if (!rawKey || !rawKey.startsWith('mh_')) return null;
  const hash = hashSessionId(rawKey);
  const row = await db
    .select({ key: consumerKeys, app: apps })
    .from(consumerKeys)
    .innerJoin(apps, eq(consumerKeys.appId, apps.id))
    .where(
      and(
        eq(consumerKeys.keyHash, hash),
        eq(consumerKeys.enabled, true),
        isNull(consumerKeys.revokedAt),
      ),
    )
    .get();
  if (!row) return null;
  if (!row.app.enabled) return null;
  return { key: row.key, app: row.app };
}

// Find all access grants for a consumer key. Used by /v1/models.
export async function listConsumerKeyAccess(
  db: Db,
  consumerKeyId: string,
): Promise<ConsumerKeyAccessRow[]> {
  return await db
    .select()
    .from(consumerKeyAccess)
    .where(eq(consumerKeyAccess.consumerKeyId, consumerKeyId))
    .all();
}

// Fastify preHandler that requires a valid consumer key, attaches the key and
// the owning app to the request, and throws AuthenticationError otherwise.
export function requireConsumerKey(
  db: Db,
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req, _reply) => {
    const raw = extractRawConsumerKey(req);
    if (!raw) {
      throw new AuthenticationError('Missing consumer key');
    }
    const found = await findActiveConsumerKey(db, raw);
    if (!found) {
      throw new AuthenticationError('Invalid or revoked consumer key');
    }
    (req as AuthenticatedConsumerRequest).consumerKey = found.key;
    (req as AuthenticatedConsumerRequest).app = found.app;
  };
}

// Re-export PermissionError from the shared package so gateway handlers can
// import both auth-style errors from one place.
export { AuthenticationError, PermissionError };
