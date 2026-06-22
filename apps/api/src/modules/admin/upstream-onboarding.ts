import { and, asc, eq, sql } from 'drizzle-orm';
import { generateId, type ProviderType, type SourceProtocol } from '@modelharbor/shared';
import type { Db } from '../db/index.js';
import { publicModelCandidates, publicModels } from '../db/tables/models.js';
import { targetNames } from '../db/tables/routing.js';
import { upstreamKeys } from '../db/tables/upstream.js';
import { getModelMappings, type ProviderPreset } from '../providers/presets.js';

export interface OnboardingResult {
  publicModelIds: string[];
}

export interface OnboardingMapping {
  publicName: string;
  realName: string;
  enabled: boolean;
  endpointProtocol?: SourceProtocol;
  endpointProviderType?: ProviderType;
  endpointBaseUrl?: string;
  endpointApiPath?: string;
}

function normalizePublicName(name: string): string {
  return name.trim().toLowerCase();
}

async function findPublicModelByName(tx: Db, name: string) {
  // Prefer an exact case match so admin-provided names like `MiniMax-M3` and
  // upstream-derived lowercase names like `minimax-m3` don't collapse into the
  // same rowid-first row when both forms already exist. Fall back to
  // case-insensitive matching so legacy mixed-case rows still get reused when
  // a lowercase version doesn't exist yet.
  const exact = await tx
    .select({ id: publicModels.id, name: publicModels.name })
    .from(publicModels)
    .where(eq(publicModels.name, name))
    .get();
  if (exact) return exact;
  return tx
    .select({ id: publicModels.id, name: publicModels.name })
    .from(publicModels)
    .where(sql`lower(${publicModels.name}) = lower(${name})`)
    .get();
}

function candidateEndpointFields(mapping: {
  endpointProtocol?: SourceProtocol;
  endpointProviderType?: ProviderType;
  endpointBaseUrl?: string;
  endpointApiPath?: string;
}) {
  if (!mapping.endpointProtocol || !mapping.endpointProviderType || !mapping.endpointBaseUrl) {
    return {};
  }
  return {
    endpointProtocol: mapping.endpointProtocol,
    endpointProviderType: mapping.endpointProviderType,
    endpointBaseUrl: mapping.endpointBaseUrl,
    endpointApiPath: mapping.endpointApiPath,
  };
}

async function nextCandidatePriority(
  tx: Db,
  publicModelId: string,
  upstreamKeyId: string,
): Promise<number> {
  const publicModel = await tx
    .select({ candidateOrderCustomized: publicModels.candidateOrderCustomized })
    .from(publicModels)
    .where(eq(publicModels.id, publicModelId))
    .get();
  if (publicModel?.candidateOrderCustomized) {
    const maxRow = await tx
      .select({ maxPriority: sql<number>`max(${publicModelCandidates.priority})` })
      .from(publicModelCandidates)
      .where(eq(publicModelCandidates.publicModelId, publicModelId))
      .get();
    return (maxRow?.maxPriority ?? 0) + 10;
  }
  const upstream = await tx
    .select({ displayOrder: upstreamKeys.displayOrder })
    .from(upstreamKeys)
    .where(eq(upstreamKeys.id, upstreamKeyId))
    .get();
  return upstream?.displayOrder ?? 1000;
}

export async function resetPublicModelCandidateOrder(
  db: Db,
  publicModelId: string,
  customized: boolean,
): Promise<void> {
  const rows = await db
    .select({ c: publicModelCandidates, u: upstreamKeys })
    .from(publicModelCandidates)
    .innerJoin(upstreamKeys, eq(publicModelCandidates.upstreamKeyId, upstreamKeys.id))
    .where(eq(publicModelCandidates.publicModelId, publicModelId))
    .orderBy(asc(upstreamKeys.displayOrder), asc(publicModelCandidates.createdAt))
    .all();
  await db.transaction(async (tx) => {
    for (let idx = 0; idx < rows.length; idx += 1) {
      await tx
        .update(publicModelCandidates)
        .set({ priority: (idx + 1) * 10, updatedAt: new Date() })
        .where(eq(publicModelCandidates.id, rows[idx]!.c.id));
    }
    await tx
      .update(publicModels)
      .set({ candidateOrderCustomized: customized, updatedAt: new Date() })
      .where(eq(publicModels.id, publicModelId));
  });
}

// Create or reuse public models, candidates, and a model group for a newly
// created upstream key based on its provider preset. Existing public models
// and groups with matching names are reused so the same preset can be applied
// to multiple upstream keys without name collisions.
export async function onboardUpstreamKey(
  db: Db,
  upstreamKeyId: string,
  preset: ProviderPreset,
): Promise<OnboardingResult> {
  const mappings = getModelMappings(preset).map((m) => ({ ...m, enabled: true }));
  return onboardUpstreamKeyWithMappings(db, upstreamKeyId, mappings);
}

// Same as onboardUpstreamKey but with caller-supplied mappings. Used when the
// admin customizes the model list in the UI.
export async function onboardUpstreamKeyWithMappings(
  db: Db,
  upstreamKeyId: string,
  mappings: OnboardingMapping[],
): Promise<OnboardingResult> {
  const now = new Date();
  const publicModelIds: string[] = [];

  await db.transaction(async (tx) => {
    // 1. Ensure public models and candidates exist for every enabled mapping.
    for (const mapping of mappings) {
      if (!mapping.enabled) continue;

      const publicName = normalizePublicName(mapping.publicName);
      const realName = mapping.realName.trim();
      let pmId: string;
      const existingPm = await findPublicModelByName(tx as unknown as Db, publicName);
      if (existingPm) {
        pmId = existingPm.id;
        // Same case-folding logic as syncUpstreamKeyMappings: when we matched
        // case-insensitively and the stored name differs in case, fold the
        // legacy row into the canonical lowercase name. Skip if a lowercase
        // sibling already exists.
        if (existingPm.name !== publicName) {
          const sibling = await tx
            .select({ id: publicModels.id })
            .from(publicModels)
            .where(and(eq(publicModels.name, publicName), sql`${publicModels.id} != ${existingPm.id}`))
            .get();
          if (!sibling) {
            await tx
              .update(publicModels)
              .set({ name: publicName, updatedAt: now })
              .where(eq(publicModels.id, existingPm.id));
            await tx
              .update(targetNames)
              .set({ name: publicName })
              .where(
                and(
                  eq(targetNames.targetType, 'public_model'),
                  eq(targetNames.targetId, existingPm.id),
                ),
              );
          } else {
            pmId = sibling.id;
          }
        }
      } else {
        pmId = generateId('publicModel');
        await tx.insert(publicModels).values({
          id: pmId,
          name: publicName,
          displayName: publicName,
          description: null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(targetNames).values({
          id: `tn_${generateId('publicModel').slice(-8)}`,
          name: publicName,
          targetType: 'public_model',
          targetId: pmId,
          createdAt: now,
        });
      }
      publicModelIds.push(pmId);

      const existingCandidate = await tx
        .select({ id: publicModelCandidates.id })
        .from(publicModelCandidates)
        .where(
          and(
            eq(publicModelCandidates.publicModelId, pmId),
            eq(publicModelCandidates.upstreamKeyId, upstreamKeyId),
            eq(publicModelCandidates.realModelName, realName),
          ),
        )
        .get();
      if (!existingCandidate) {
        const priority = await nextCandidatePriority(tx as unknown as Db, pmId, upstreamKeyId);
        await tx.insert(publicModelCandidates).values({
          id: generateId('publicModel') + '_c',
          publicModelId: pmId,
          upstreamKeyId,
          realModelName: realName,
          ...candidateEndpointFields(mapping),
          enabled: true,
          priority,
          weight: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  });

  return { publicModelIds };
}

export interface UpstreamKeyCandidateMapping {
  publicName: string;
  realName: string;
  enabled: boolean;
  endpointProtocol?: SourceProtocol;
  endpointProviderType?: ProviderType;
  endpointBaseUrl?: string;
  endpointApiPath?: string;
}

export interface UpstreamKeyCandidate {
  id: string;
  publicModelId: string;
  publicName: string;
  realName: string;
  enabled: boolean;
  priority: number;
  weight: number;
  endpointProtocol: string | null;
  endpointProviderType: string | null;
  endpointBaseUrl: string | null;
  endpointApiPath: string | null;
  lastPingAt: Date | null;
  lastPingOk: boolean | null;
  lastPingStatus: number | null;
  lastPingLatencyMs: number | null;
  lastPingError: string | null;
}

// Fully synchronize the public-model candidates for an upstream key with the
// caller-supplied mappings. Creates public models and target names as needed,
// updates existing candidates, and removes candidates no longer present.
export async function getUpstreamKeyCandidates(
  db: Db,
  upstreamKeyId: string,
): Promise<UpstreamKeyCandidate[]> {
  const rows = await db
    .select({ c: publicModelCandidates, p: publicModels })
    .from(publicModelCandidates)
    .innerJoin(publicModels, eq(publicModelCandidates.publicModelId, publicModels.id))
    .where(eq(publicModelCandidates.upstreamKeyId, upstreamKeyId))
    .all();
  return rows.map(({ c, p }) => ({
    id: c.id,
    publicModelId: c.publicModelId,
    publicName: p.name,
    realName: c.realModelName,
    enabled: c.enabled,
    priority: c.priority,
    weight: c.weight,
    endpointProtocol: c.endpointProtocol,
    endpointProviderType: c.endpointProviderType,
    endpointBaseUrl: c.endpointBaseUrl,
    endpointApiPath: c.endpointApiPath,
    lastPingAt: c.lastPingAt,
    lastPingOk: c.lastPingOk,
    lastPingStatus: c.lastPingStatus,
    lastPingLatencyMs: c.lastPingLatencyMs,
    lastPingError: c.lastPingError,
  }));
}

export async function syncUpstreamKeyMappings(
  db: Db,
  upstreamKeyId: string,
  mappings: UpstreamKeyCandidateMapping[],
): Promise<UpstreamKeyCandidate[]> {
  const now = new Date();
  const activeMappings = mappings.filter((m) => m.enabled && m.realName.trim() !== '');

  return db.transaction(async (tx) => {
    // 1. Ensure public models exist for every active mapping and collect IDs.
    const desired = new Map<string, UpstreamKeyCandidateMapping>();
    for (const mapping of activeMappings) {
      const publicName = normalizePublicName(mapping.publicName) || mapping.realName.trim().toLowerCase();
      const realName = mapping.realName.trim();
      const key = `${publicName}\0${realName}`;
      desired.set(key, { ...mapping, publicName, realName });

      let pmId: string;
      const existingPm = await findPublicModelByName(tx as unknown as Db, publicName);
      if (existingPm) {
        pmId = existingPm.id;
        // If we matched case-insensitively but the stored name differs in case
        // (e.g. legacy `MiniMax-M2.7-highspeed` vs the canonical lowercase
        // `minimax-m2.7-highspeed`), fold the legacy row into the canonical
        // name so PM lookups are stable going forward. The rename is skipped
        // when a sibling row already owns the lowercase name — in that case
        // findPublicModelByName's exact-match branch would have returned it
        // first and pmId would point at that sibling already.
        if (existingPm.name !== publicName) {
          const sibling = await tx
            .select({ id: publicModels.id })
            .from(publicModels)
            .where(and(eq(publicModels.name, publicName), sql`${publicModels.id} != ${existingPm.id}`))
            .get();
          if (!sibling) {
            await tx
              .update(publicModels)
              .set({ name: publicName, updatedAt: now })
              .where(eq(publicModels.id, existingPm.id));
            await tx
              .update(targetNames)
              .set({ name: publicName })
              .where(
                and(
                  eq(targetNames.targetType, 'public_model'),
                  eq(targetNames.targetId, existingPm.id),
                ),
              );
          } else {
            // A lowercase sibling already exists — switch the candidate to it
            // so we don't leave a forked PM behind.
            pmId = sibling.id;
          }
        }
      } else {
        pmId = generateId('publicModel');
        await tx.insert(publicModels).values({
          id: pmId,
          name: publicName,
          displayName: publicName,
          description: null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(targetNames).values({
          id: `tn_${generateId('publicModel').slice(-8)}`,
          name: publicName,
          targetType: 'public_model',
          targetId: pmId,
          createdAt: now,
        });
      }
    }

    // 2. Load existing candidates for this upstream key.
    const existing = await tx
      .select({ c: publicModelCandidates, p: publicModels })
      .from(publicModelCandidates)
      .innerJoin(publicModels, eq(publicModelCandidates.publicModelId, publicModels.id))
      .where(eq(publicModelCandidates.upstreamKeyId, upstreamKeyId))
      .all();

    // 3. Upsert: update existing candidates, insert missing ones. Keys here MUST
    // match the form used to build `desired` above (normalized publicName + raw
    // realModelName); otherwise every save degenerates into delete-then-reinsert,
    // which churns audit rows and can race the candidate UNIQUE index when a
    // public model has both mixed- and lower-cased siblings pointing at the same
    // upstream key.
    const result: UpstreamKeyCandidate[] = [];
    const handled = new Set<string>();
    for (const { c, p } of existing) {
      const key = `${normalizePublicName(p.name)}\0${c.realModelName}`;
      const mapping = desired.get(key);
      if (mapping) {
        await tx
          .update(publicModelCandidates)
          .set({
            enabled: mapping.enabled,
            ...candidateEndpointFields(mapping),
            updatedAt: now,
          })
          .where(eq(publicModelCandidates.id, c.id));
        result.push({
          id: c.id,
          publicModelId: c.publicModelId,
          publicName: p.name,
          realName: c.realModelName,
          enabled: mapping.enabled,
          priority: c.priority,
          weight: c.weight,
          endpointProtocol: mapping.endpointProtocol ?? c.endpointProtocol,
          endpointProviderType: mapping.endpointProviderType ?? c.endpointProviderType,
          endpointBaseUrl: mapping.endpointBaseUrl ?? c.endpointBaseUrl,
          endpointApiPath: mapping.endpointApiPath ?? c.endpointApiPath,
          lastPingAt: c.lastPingAt,
          lastPingOk: c.lastPingOk,
          lastPingStatus: c.lastPingStatus,
          lastPingLatencyMs: c.lastPingLatencyMs,
          lastPingError: c.lastPingError,
        });
        handled.add(key);
      }
    }

    for (const [key, mapping] of desired) {
      if (handled.has(key)) continue;
      const pm = await findPublicModelByName(tx as unknown as Db, mapping.publicName);
      if (!pm) continue; // Should not happen since we created above.
      const id = generateId('publicModel') + '_c';
      const priority = await nextCandidatePriority(tx as unknown as Db, pm.id, upstreamKeyId);
      await tx.insert(publicModelCandidates).values({
        id,
        publicModelId: pm.id,
        upstreamKeyId,
        realModelName: mapping.realName,
        ...candidateEndpointFields(mapping),
        enabled: mapping.enabled,
        priority,
        weight: 1,
        createdAt: now,
        updatedAt: now,
      });
      result.push({
        id,
        publicModelId: pm.id,
        publicName: mapping.publicName,
        realName: mapping.realName,
        enabled: mapping.enabled,
        priority,
        weight: 1,
        endpointProtocol: mapping.endpointProtocol ?? null,
        endpointProviderType: mapping.endpointProviderType ?? null,
        endpointBaseUrl: mapping.endpointBaseUrl ?? null,
        endpointApiPath: mapping.endpointApiPath ?? null,
        lastPingAt: null,
        lastPingOk: null,
        lastPingStatus: null,
        lastPingLatencyMs: null,
        lastPingError: null,
      });
      handled.add(key);
    }

    // 4. Delete candidates that are no longer in the active mapping list.
    const desiredKeys = new Set(desired.keys());
    for (const { c, p } of existing) {
      const key = `${p.name}\0${c.realModelName}`;
      if (!desiredKeys.has(key)) {
        await tx.delete(publicModelCandidates).where(eq(publicModelCandidates.id, c.id));
      }
    }

    return result;
  });
}
