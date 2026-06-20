// Audit logging (post-M7 hardening).
//
// Records admin-side actions to the `audit_events` table. The store is
// best-effort: a failure to write an audit row must never break the action
// itself, but the same writer is used by the rate limiter so dropping a row
// is at least visible in tests.

import { generateId } from '@modelharbor/shared';
import type { Db } from '../db/index.js';
import { type AuditEventInsert, auditEvents } from '../db/tables/observability.js';
import { redactValue } from './redaction.js';

export type AuditAction =
  | 'admin.login.success'
  | 'admin.login.failure'
  | 'admin.logout'
  | 'admin.password.change'
  | 'upstream_key.create'
  | 'upstream_key.update'
  | 'upstream_key.freeze'
  | 'upstream_key.unfreeze'
  | 'upstream_key.rotate_secret'
  | 'upstream_key.delete'
  | 'public_model.create'
  | 'public_model.update'
  | 'public_model.delete'
  | 'model_group.create'
  | 'model_group.update'
  | 'model_group.delete'
  | 'app.create'
  | 'app.update'
  | 'consumer_key.create'
  | 'consumer_key.revoke'
  | 'consumer_key.rotate'
  | 'consumer_key.access.update';

export interface AuditEventInput {
  actorAdminId: string | null;
  actorUsername: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
  now?: Date;
}

export async function recordAuditEvent(db: Db, input: AuditEventInput): Promise<void> {
  try {
    const row: AuditEventInsert = {
      id: generateId('auditEvent'),
      actorAdminId: input.actorAdminId,
      actorUsername: input.actorUsername,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      detailsJson: input.details ? JSON.stringify(redactValue(input.details)) : null,
      ip: input.ip ?? null,
      createdAt: input.now ?? new Date(),
    };
    await db.insert(auditEvents).values(row);
  } catch {
    /* best-effort */
  }
}
