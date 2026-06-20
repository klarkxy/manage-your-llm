import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  type ConsumerKeyAccessRow,
  consumerKeyAccess,
} from '../db/tables/apps.js';
import {
  type TargetType,
} from '../db/tables/routing.js';
import { PermissionError } from '@modelharbor/shared';

// Throw PermissionError if the consumer key does not have an access grant
// pointing at (targetType, targetId). The grant table is the authoritative
// source for "what can this key call" — public model or model group alike.
export async function assertConsumerKeyAccess(
  db: Db,
  args: { consumerKeyId: string; targetType: TargetType; targetId: string },
): Promise<void> {
  const row: ConsumerKeyAccessRow | undefined = await db
    .select()
    .from(consumerKeyAccess)
    .where(
      and(
        eq(consumerKeyAccess.consumerKeyId, args.consumerKeyId),
        eq(consumerKeyAccess.targetType, args.targetType),
        eq(consumerKeyAccess.targetId, args.targetId),
      ),
    )
    .get();
  if (!row) {
    throw new PermissionError(
      `consumer key is not authorized for ${args.targetType} ${args.targetId}`,
    );
  }
}
