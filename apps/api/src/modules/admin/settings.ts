// Admin routes for global settings and circuit breaker management (M9).

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { adminSettings } from '../db/tables/settings.js';
import {
  ensureDefaultCircuitBreakerSettings,
  getCircuitBreakerSettings,
  listCircuitBreakers,
  resetCircuitBreaker,
} from '../router/circuit-breaker.js';
import {
  getContentLogSettings,
  type ContentLogSettings,
} from '../observability/content-logs.js';
import {
  isAutoGroupPreset,
  normalizeAutoWeights,
  type AutoGroupWeights,
} from './model-reference.js';
import { createEnv, getPublicBaseUrl } from '../../config/env.js';

export interface SettingsRouteDeps {
  db: Db;
}

/**
 * Resolved public-facing endpoint URLs the API exposes to client
 * applications (LLM clients that hold a consumer key). Returned by both
 * GET / PUT /api/admin/settings so the Settings page and the Overview
 * page can show copy-pasteable URLs.
 */
export interface PublicEndpointsBlock {
  /** Configured base path prefix, e.g. `/v1` or `/api/v1`. */
  basePath: string;
  /** Resolved public base URL, e.g. `https://llm.example.com`. */
  baseUrl: string;
  endpoints: {
    messages: string;
    chatCompletions: string;
    responses: string;
    models: string;
  };
}

function buildPublicEndpoints(basePath: string): PublicEndpointsBlock {
  const base = (basePath || '/v1').replace(/\/+$/, '') || '/v1';
  const host = getPublicBaseUrl(createEnv());
  return {
    basePath: base,
    baseUrl: host,
    endpoints: {
      messages: `${host}${base}/messages`,
      chatCompletions: `${host}${base}/chat/completions`,
      responses: `${host}${base}/responses`,
      models: `${host}${base}/models`,
    },
  };
}

export function registerSettingsRoutes(app: FastifyInstance, deps: SettingsRouteDeps): void {
  const { db } = deps;

  app.get('/api/admin/settings', async () => {
    await ensureDefaultCircuitBreakerSettings(db);
    const settings = await getCircuitBreakerSettings(db);
    const contentLog = await getContentLogSettings(db);
    const row = await db.select().from(adminSettings).where(eq(adminSettings.id, 'default')).get();
    return {
      circuitBreaker: {
        enabled: settings.circuitBreakerEnabled,
        failureThreshold: settings.circuitBreakerFailureThreshold,
        baseCooldownMs: settings.circuitBreakerBaseCooldownMs,
        maxCooldownMs: settings.circuitBreakerMaxCooldownMs,
        halfOpenSuccessCount: settings.circuitBreakerHalfOpenSuccessCount,
      },
      endpointHealth: {
        probeEnabled: settings.endpointHealthProbeEnabled,
        probeIntervalMs: settings.endpointHealthProbeIntervalMs,
        probeTimeoutMs: settings.endpointHealthProbeTimeoutMs,
        degradedLatencyMs: settings.endpointHealthProbeDegradedLatencyMs,
      },
      streaming: {
        firstTokenTimeoutMs: settings.firstTokenTimeoutMs,
      },
      contentLogging: {
        enabled: contentLog.enabled,
        retentionDays: contentLog.retentionDays,
        maxPayloadBytes: contentLog.maxPayloadBytes,
      },
      modelReference: {
        autoPreset: row?.modelReferenceAutoPreset ?? 'balanced',
        autoWeights: row?.modelReferenceAutoWeightsJson
          ? JSON.parse(row.modelReferenceAutoWeightsJson) as AutoGroupWeights
          : normalizeAutoWeights('balanced', undefined),
        autoTopN: row?.modelReferenceAutoTopN ?? 5,
      },
      publicEndpoints: buildPublicEndpoints(row?.publicEndpointsBasePath ?? '/v1'),
    };
  });

  app.put('/api/admin/settings', async (req, reply) => {
    const body = (req.body ?? {}) as {
      circuitBreaker?: {
        enabled?: boolean;
        failureThreshold?: number;
        baseCooldownMs?: number;
        maxCooldownMs?: number;
        halfOpenSuccessCount?: number;
      };
      endpointHealth?: {
        probeEnabled?: boolean;
        probeIntervalMs?: number;
        probeTimeoutMs?: number;
        degradedLatencyMs?: number;
      };
      streaming?: {
        firstTokenTimeoutMs?: number;
      };
      contentLogging?: Partial<ContentLogSettings>;
      modelReference?: {
        autoPreset?: unknown;
        autoWeights?: unknown;
        autoTopN?: unknown;
      };
      publicEndpoints?: {
        basePath?: string;
      };
    };
    const cbInput = body.circuitBreaker ?? {};
    const ehInput = body.endpointHealth ?? {};
    const streamInput = body.streaming ?? {};
    const clInput = body.contentLogging ?? {};
    const mrInput = body.modelReference ?? {};
    const peInput = body.publicEndpoints ?? {};

    const values: Partial<typeof adminSettings.$inferInsert> = {};
    if (typeof cbInput.enabled === 'boolean') values.circuitBreakerEnabled = cbInput.enabled;
    if (typeof cbInput.failureThreshold === 'number') {
      values.circuitBreakerFailureThreshold = Math.max(1, Math.round(cbInput.failureThreshold));
    }
    if (typeof cbInput.baseCooldownMs === 'number') {
      values.circuitBreakerBaseCooldownMs = Math.max(1000, Math.round(cbInput.baseCooldownMs));
    }
    if (typeof cbInput.maxCooldownMs === 'number') {
      values.circuitBreakerMaxCooldownMs = Math.max(1000, Math.round(cbInput.maxCooldownMs));
    }
    if (typeof cbInput.halfOpenSuccessCount === 'number') {
      values.circuitBreakerHalfOpenSuccessCount = Math.max(1, Math.round(cbInput.halfOpenSuccessCount));
    }
    if (typeof ehInput.probeEnabled === 'boolean') values.endpointHealthProbeEnabled = ehInput.probeEnabled;
    if (typeof ehInput.probeIntervalMs === 'number') {
      values.endpointHealthProbeIntervalMs = Math.max(60_000, Math.round(ehInput.probeIntervalMs));
    }
    if (typeof ehInput.probeTimeoutMs === 'number') {
      values.endpointHealthProbeTimeoutMs = Math.max(1_000, Math.round(ehInput.probeTimeoutMs));
    }
    if (typeof ehInput.degradedLatencyMs === 'number') {
      values.endpointHealthProbeDegradedLatencyMs = Math.max(1_000, Math.round(ehInput.degradedLatencyMs));
    }
    if (typeof streamInput.firstTokenTimeoutMs === 'number') {
      values.firstTokenTimeoutMs = Math.max(0, Math.round(streamInput.firstTokenTimeoutMs));
    }
    if (typeof clInput.enabled === 'boolean') values.contentLogEnabled = clInput.enabled;
    if (typeof clInput.retentionDays === 'number') {
      values.contentLogRetentionDays = Math.max(1, Math.round(clInput.retentionDays));
    }
    if (typeof clInput.maxPayloadBytes === 'number') {
      values.contentLogMaxPayloadBytes = Math.max(0, Math.round(clInput.maxPayloadBytes));
    }
    if (isAutoGroupPreset(mrInput.autoPreset)) {
      values.modelReferenceAutoPreset = mrInput.autoPreset;
    }
    if (mrInput.autoWeights && typeof mrInput.autoWeights === 'object' && !Array.isArray(mrInput.autoWeights)) {
      const preset = isAutoGroupPreset(mrInput.autoPreset)
        ? mrInput.autoPreset
        : isAutoGroupPreset(values.modelReferenceAutoPreset)
          ? values.modelReferenceAutoPreset
          : 'balanced';
      values.modelReferenceAutoWeightsJson = JSON.stringify(normalizeAutoWeights(preset, mrInput.autoWeights));
    }
    if (typeof mrInput.autoTopN === 'number') {
      values.modelReferenceAutoTopN = Math.max(1, Math.min(20, Math.round(mrInput.autoTopN)));
    }
    if (typeof peInput.basePath === 'string' && peInput.basePath.trim().length > 0) {
      const trimmed = peInput.basePath.trim();
      if (!trimmed.startsWith('/')) {
        reply.code(400);
        return {
          error: {
            message: 'publicEndpoints.basePath must start with "/"',
            type: 'validation_error',
            code: 'invalid_base_path',
          },
        };
      }
      values.publicEndpointsBasePath = trimmed.replace(/\/+$/, '') || '/v1';
    }

    await ensureDefaultCircuitBreakerSettings(db);
    await db.update(adminSettings).set({ ...values, updatedAt: new Date() }).where(eq(adminSettings.id, 'default'));

    const updated = await getCircuitBreakerSettings(db);
    const contentLog = await getContentLogSettings(db);
    const row = await db.select().from(adminSettings).where(eq(adminSettings.id, 'default')).get();
    return {
      circuitBreaker: {
        enabled: updated.circuitBreakerEnabled,
        failureThreshold: updated.circuitBreakerFailureThreshold,
        baseCooldownMs: updated.circuitBreakerBaseCooldownMs,
        maxCooldownMs: updated.circuitBreakerMaxCooldownMs,
        halfOpenSuccessCount: updated.circuitBreakerHalfOpenSuccessCount,
      },
      endpointHealth: {
        probeEnabled: updated.endpointHealthProbeEnabled,
        probeIntervalMs: updated.endpointHealthProbeIntervalMs,
        probeTimeoutMs: updated.endpointHealthProbeTimeoutMs,
        degradedLatencyMs: updated.endpointHealthProbeDegradedLatencyMs,
      },
      streaming: {
        firstTokenTimeoutMs: updated.firstTokenTimeoutMs,
      },
      contentLogging: {
        enabled: contentLog.enabled,
        retentionDays: contentLog.retentionDays,
        maxPayloadBytes: contentLog.maxPayloadBytes,
      },
      modelReference: {
        autoPreset: row?.modelReferenceAutoPreset ?? 'balanced',
        autoWeights: row?.modelReferenceAutoWeightsJson
          ? JSON.parse(row.modelReferenceAutoWeightsJson) as AutoGroupWeights
          : normalizeAutoWeights('balanced', undefined),
        autoTopN: row?.modelReferenceAutoTopN ?? 5,
      },
      publicEndpoints: buildPublicEndpoints(row?.publicEndpointsBasePath ?? '/v1'),
    };
  });

  app.get('/api/admin/circuit-breakers', async (req) => {
    const q = (req.query ?? {}) as { state?: 'closed' | 'open' | 'half_open'; limit?: string };
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? '100') || 100));
    const items = await listCircuitBreakers(db, { limit, state: q.state });
    return { items };
  });

  app.post('/api/admin/circuit-breakers/:id/reset', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await resetCircuitBreaker(db, { id, now: new Date() });
    if (!ok) {
      reply.code(404).send({ error: { message: 'Circuit breaker not found', type: 'not_found', code: 'not_found' } });
      return;
    }
    return { ok: true };
  });
}
