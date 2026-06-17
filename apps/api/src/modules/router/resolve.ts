import { eq } from "drizzle-orm";
import {
  type Db,
  type TargetNameRow,
  type TargetType,
  targetNames,
} from "../db/index.js";
import { TargetNotFoundError } from "@modelharbor/shared";

export interface ResolvedTarget {
  name: string;
  targetType: TargetType;
  targetId: string;
}

// Look up a target (public model or model group) by its public name. The name
// is the client-facing string the gateway receives in `model`. Names are
// globally unique across both namespaces; resolving a name returns the
// underlying row id and type so the router can pull the right candidates.
export async function resolveTargetByName(
  db: Db,
  name: string,
): Promise<ResolvedTarget> {
  if (!name || typeof name !== "string") {
    throw new TargetNotFoundError("model is required");
  }
  const trimmed = name.trim();
  if (!trimmed) throw new TargetNotFoundError("model is required");
  const row: TargetNameRow | undefined = await db
    .select()
    .from(targetNames)
    .where(eq(targetNames.name, trimmed))
    .get();
  if (!row) throw new TargetNotFoundError(`model not found: ${trimmed}`);
  return { name: row.name, targetType: row.targetType, targetId: row.targetId };
}
