// Health endpoints.
// `/healthz` is a liveness probe — it returns 200 as long as the process
// is alive and the event loop responds. `/readyz` is a readiness probe —
// when a database is wired into the server, the probe issues a SELECT 1
// against it. If the database is unreachable the probe returns 503 with a
// short error message; load balancers and orchestrators can then stop
// sending traffic to this instance until it recovers.

import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { type Db } from '../modules/db/index.js';

export interface HealthRouteDeps {
  db?: Db;
}

export async function healthRoutes(
  app: FastifyInstance,
  deps: HealthRouteDeps = {},
): Promise<void> {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_req, reply) => {
    if (!deps.db) {
      return { status: 'ok' };
    }
    try {
      await deps.db.get(sql`SELECT 1`);
      return { status: 'ok' };
    } catch (err) {
      reply.code(503);
      return {
        status: 'degraded',
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  });
}
