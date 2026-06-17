import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { generateId, ValidationError } from "@modelharbor/shared";
import { type UpstreamKeyCounterRow, type UpstreamKeyQuotaRow, type UpstreamKeyQuotaInsert, type UpstreamKeyRow, type Db, upstreamKeyCounters, upstreamKeyQuotas, upstreamKeys } from "../db/index.js";
import { resetExpiredCounters } from "../quota/index.js";
import { listStickyBindingsForConsumer, pruneExpiredStickyBindings } from "../sticky/index.js";
import {
  assertProviderType,
  assertQuotaPeriod,
  assertPositiveInt,
  decryptUpstreamApiKey,
  encryptUpstreamApiKey,
  parseJsonArray,
  parseJsonObject,
  safeJsonString,
} from "./helpers.js";

export interface UpstreamKeyRouteDeps {
  db: Db;
  secretKey: string;
}

interface CreateUpstreamKeyBody {
  name?: unknown;
  providerType?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  defaultHeaders?: unknown;
  supportedModels?: unknown;
  quota?: {
    period?: unknown;
    requestLimit?: unknown;
    inputTokenLimit?: unknown;
    outputTokenLimit?: unknown;
    totalTokenLimit?: unknown;
  };
}

function presentUpstreamKey(
  row: UpstreamKeyRow,
  quota: UpstreamKeyQuotaRow | null,
  counters: UpstreamKeyCounterRow[],
) {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKeyPrefix: row.apiKeyPrefix,
    defaultHeaders: parseJsonObject(row.defaultHeadersJson),
    supportedModels: parseJsonArray(row.supportedModelsJson),
    enabled: row.enabled,
    frozen: row.frozen,
    frozenReason: row.frozenReason,
    cooldownUntil: row.cooldownUntil,
    lastHealthStatus: row.lastHealthStatus,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    quota: quota
      ? {
          period: quota.period,
          requestLimit: quota.requestLimit,
          inputTokenLimit: quota.inputTokenLimit,
          outputTokenLimit: quota.outputTokenLimit,
          totalTokenLimit: quota.totalTokenLimit,
          enabled: quota.enabled,
        }
      : null,
    counters: counters.map((c) => presentCounter(c)),
  };
}

function presentCounter(c: UpstreamKeyCounterRow) {
  return {
    id: c.id,
    period: c.period,
    periodStartedAt: c.periodStartedAt,
    periodEndsAt: c.periodEndsAt,
    requestCount: c.requestCount,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    totalTokens: c.totalTokens,
  };
}

export function registerUpstreamKeyRoutes(app: FastifyInstance, deps: UpstreamKeyRouteDeps): void {
  const { db, secretKey } = deps;

  app.get("/api/admin/upstream-keys", async () => {
    const rows = await db.select().from(upstreamKeys).orderBy(desc(upstreamKeys.createdAt)).all();
    const quotas = await db.select().from(upstreamKeyQuotas).all();
    const byId = new Map(quotas.map((q) => [q.upstreamKeyId, q]));
    const counters = await db.select().from(upstreamKeyCounters).all();
    const countersByKey = new Map<string, UpstreamKeyCounterRow[]>();
    for (const c of counters) {
      const arr = countersByKey.get(c.upstreamKeyId) ?? [];
      arr.push(c);
      countersByKey.set(c.upstreamKeyId, arr);
    }
    return {
      items: rows.map((r) => presentUpstreamKey(r, byId.get(r.id) ?? null, countersByKey.get(r.id) ?? [])),
    };
  });

  app.get("/api/admin/upstream-keys/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!row) {
      reply.code(404).send({ error: { message: "upstream key not found", type: "target_not_found", code: "target_not_found" } });
      return;
    }
    const quota = (await db.select().from(upstreamKeyQuotas).where(eq(upstreamKeyQuotas.upstreamKeyId, id)).get()) ?? null;
    return presentUpstreamKey(row, quota, []);
  });

  app.post("/api/admin/upstream-keys", async (req, reply) => {
    const body = (req.body ?? {}) as CreateUpstreamKeyBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const providerType = typeof body.providerType === "string" ? body.providerType : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
    const supportedModels = Array.isArray(body.supportedModels)
      ? body.supportedModels.filter((x): x is string => typeof x === "string")
      : [];
    if (!name) throw new ValidationError("name is required");
    if (!baseUrl) throw new ValidationError("baseUrl is required");
    assertProviderType(providerType);
    if (!apiKey) throw new ValidationError("apiKey is required");

    const existing = await db.select().from(upstreamKeys).where(eq(upstreamKeys.name, name)).get();
    if (existing) {
      reply.code(409).send({ error: { message: "upstream key name already in use", type: "validation_error", code: "validation_error" } });
      return;
    }

    const { ciphertext, prefix } = encryptUpstreamApiKey(apiKey, secretKey);
    const id = generateId("upstreamKey");
    const now = new Date();
    await db.insert(upstreamKeys).values({
      id,
      name,
      providerType,
      baseUrl,
      apiKeyCiphertext: ciphertext,
      apiKeyPrefix: prefix,
      defaultHeadersJson: safeJsonString(body.defaultHeaders, "{}"),
      supportedModelsJson: JSON.stringify(supportedModels),
      enabled: true,
      frozen: false,
      createdAt: now,
      updatedAt: now,
    });

    if (body.quota) {
      const period = typeof body.quota.period === "string" ? body.quota.period : "";
      assertQuotaPeriod(period);
      const q: UpstreamKeyQuotaInsert = {
        id: generateId("upstreamKey") + "_q",
        upstreamKeyId: id,
        period,
        requestLimit: assertPositiveInt("requestLimit", body.quota.requestLimit),
        inputTokenLimit: assertPositiveInt("inputTokenLimit", body.quota.inputTokenLimit),
        outputTokenLimit: assertPositiveInt("outputTokenLimit", body.quota.outputTokenLimit),
        totalTokenLimit: assertPositiveInt("totalTokenLimit", body.quota.totalTokenLimit),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(upstreamKeyQuotas).values(q);
    }

    const row = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!row) throw new Error("insert failed");
    const quota = (await db.select().from(upstreamKeyQuotas).where(eq(upstreamKeyQuotas.upstreamKeyId, id)).get()) ?? null;
    return presentUpstreamKey(row, quota, []);
  });

  app.patch("/api/admin/upstream-keys/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<CreateUpstreamKeyBody> & { enabled?: boolean };
    const existing = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({ error: { message: "upstream key not found", type: "target_not_found", code: "target_not_found" } });
      return;
    }
    const now = new Date();
    const update: Partial<typeof upstreamKeys.$inferInsert> = { updatedAt: now };
    if (typeof body.name === "string" && body.name.trim() !== existing.name) {
      const dup = await db.select().from(upstreamKeys).where(eq(upstreamKeys.name, body.name.trim())).get();
      if (dup) {
        reply.code(409).send({ error: { message: "upstream key name already in use", type: "validation_error", code: "validation_error" } });
        return;
      }
      update.name = body.name.trim();
    }
    if (typeof body.baseUrl === "string") update.baseUrl = body.baseUrl.trim();
    if (typeof body.providerType === "string") {
      assertProviderType(body.providerType);
      update.providerType = body.providerType;
    }
    if (Array.isArray(body.supportedModels)) {
      update.supportedModelsJson = JSON.stringify(body.supportedModels.filter((x): x is string => typeof x === "string"));
    }
    if (body.defaultHeaders !== undefined) {
      update.defaultHeadersJson = safeJsonString(body.defaultHeaders, "{}");
    }
    if (typeof body.enabled === "boolean") update.enabled = body.enabled;
    await db.update(upstreamKeys).set(update).where(eq(upstreamKeys.id, id));

    if (body.quota) {
      const period = typeof body.quota.period === "string" ? body.quota.period : "";
      assertQuotaPeriod(period);
      const existingQ = await db
        .select()
        .from(upstreamKeyQuotas)
        .where(eq(upstreamKeyQuotas.upstreamKeyId, id))
        .get();
      const values = {
        period,
        requestLimit: assertPositiveInt("requestLimit", body.quota.requestLimit),
        inputTokenLimit: assertPositiveInt("inputTokenLimit", body.quota.inputTokenLimit),
        outputTokenLimit: assertPositiveInt("outputTokenLimit", body.quota.outputTokenLimit),
        totalTokenLimit: assertPositiveInt("totalTokenLimit", body.quota.totalTokenLimit),
        enabled: true,
        updatedAt: now,
      };
      if (existingQ) {
        await db.update(upstreamKeyQuotas).set(values).where(eq(upstreamKeyQuotas.upstreamKeyId, id));
      } else {
        await db.insert(upstreamKeyQuotas).values({
          id: generateId("upstreamKey") + "_q",
          upstreamKeyId: id,
          ...values,
          createdAt: now,
        });
      }
    }

    const row = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!row) throw new Error("not found");
    const quota = (await db.select().from(upstreamKeyQuotas).where(eq(upstreamKeyQuotas.upstreamKeyId, id)).get()) ?? null;
    return presentUpstreamKey(row, quota, []);
  });

  app.post("/api/admin/upstream-keys/:id/rotate-secret", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { apiKey?: unknown };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
    if (!apiKey) throw new ValidationError("apiKey is required");
    const existing = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({ error: { message: "upstream key not found", type: "target_not_found", code: "target_not_found" } });
      return;
    }
    const { ciphertext, prefix } = encryptUpstreamApiKey(apiKey, secretKey);
    await db
      .update(upstreamKeys)
      .set({ apiKeyCiphertext: ciphertext, apiKeyPrefix: prefix, updatedAt: new Date() })
      .where(eq(upstreamKeys.id, id));
    return { id, apiKeyPrefix: prefix };
  });

  app.post("/api/admin/upstream-keys/:id/freeze", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason : "manually frozen";
    const existing = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({ error: { message: "upstream key not found", type: "target_not_found", code: "target_not_found" } });
      return;
    }
    await db
      .update(upstreamKeys)
      .set({ frozen: true, frozenReason: reason, updatedAt: new Date() })
      .where(eq(upstreamKeys.id, id));
    return { id, frozen: true, frozenReason: reason };
  });

  app.post("/api/admin/upstream-keys/:id/unfreeze", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    if (!existing) {
      reply.code(404).send({ error: { message: "upstream key not found", type: "target_not_found", code: "target_not_found" } });
      return;
    }
    await db
      .update(upstreamKeys)
      .set({ frozen: false, frozenReason: null, updatedAt: new Date() })
      .where(eq(upstreamKeys.id, id));
    return { id, frozen: false };
  });
  // M6: list sticky bindings for a consumer key. Optional filter by
  // requestedTargetName; defaults to listing all.
  app.get("/api/admin/sticky-bindings", async (req) => {
    const { appId, consumerKeyId, requestedTargetName } = req.query as {
      appId?: string;
      consumerKeyId?: string;
      requestedTargetName?: string;
    };
    if (!appId || !consumerKeyId) {
      return { items: [] };
    }
    let rows = await listStickyBindingsForConsumer(db, { appId, consumerKeyId });
    if (requestedTargetName) {
      rows = rows.filter((r) => r.requestedTargetName === requestedTargetName);
    }
    return { items: rows };
  });

  // M6: run a maintenance pass now. Resets expired counters and prunes
  // expired sticky bindings. Idempotent and safe to call from cron.
  app.post("/api/admin/maintenance/run", async () => {
    const countersRemoved = await resetExpiredCounters(db, new Date());
    const stickyRemoved = await pruneExpiredStickyBindings(db, new Date());
    return { countersRemoved, stickyRemoved };
  });

  // Internal helper exposed for tests; not part of admin API.
  app.delete("/api/admin/upstream-keys/:id", async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(upstreamKeys).where(eq(upstreamKeys.id, id));
    return { id, deleted: true };
  });
}

// Exported for test use only; decrypts the stored ciphertext using the secret key.
export function decryptUpstreamApiKeyForTest(ciphertext: string, secretKey: string): string {
  return decryptUpstreamApiKey(ciphertext, secretKey);
}
