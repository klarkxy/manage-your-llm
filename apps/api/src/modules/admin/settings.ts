// Admin routes for global settings and circuit breaker management (M9).

import type { FastifyInstance } from 'fastify';
import { type Db } from '../db/index.js';
import {
  ensureDefaultCircuitBreakerSettings,
  getCircuitBreakerSettings,
  listCircuitBreakers,
  resetCircuitBreaker,
  updateCircuitBreakerSettings,
} from '../router/circuit-breaker.js';

export interface SettingsRouteDeps {
  db: Db;
}

export function registerSettingsRoutes(app: FastifyInstance, deps: SettingsRouteDeps): void {
  const { db } = deps;

  app.get('/api/admin/settings', async () => {
    await ensureDefaultCircuitBreakerSettings(db);
    const settings = await getCircuitBreakerSettings(db);
    return {
      circuitBreaker: {
        enabled: settings.circuitBreakerEnabled,
        failureThreshold: settings.circuitBreakerFailureThreshold,
        baseCooldownMs: settings.circuitBreakerBaseCooldownMs,
        maxCooldownMs: settings.circuitBreakerMaxCooldownMs,
        halfOpenSuccessCount: settings.circuitBreakerHalfOpenSuccessCount,
      },
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
    };
    const input = body.circuitBreaker ?? {};
    const updated = await updateCircuitBreakerSettings(db, {
      circuitBreakerEnabled: input.enabled,
      circuitBreakerFailureThreshold: input.failureThreshold,
      circuitBreakerBaseCooldownMs: input.baseCooldownMs,
      circuitBreakerMaxCooldownMs: input.maxCooldownMs,
      circuitBreakerHalfOpenSuccessCount: input.halfOpenSuccessCount,
    });
    return {
      circuitBreaker: {
        enabled: updated.circuitBreakerEnabled,
        failureThreshold: updated.circuitBreakerFailureThreshold,
        baseCooldownMs: updated.circuitBreakerBaseCooldownMs,
        maxCooldownMs: updated.circuitBreakerMaxCooldownMs,
        halfOpenSuccessCount: updated.circuitBreakerHalfOpenSuccessCount,
      },
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
