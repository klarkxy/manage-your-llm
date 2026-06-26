import type { FastifyInstance } from 'fastify';
import {
  listBreakersResponseSchema,
  resetBreakerResponseSchema,
  stickyOverviewResponseSchema,
  stickyQuerySchema,
} from '@manageyourllm/contracts';
import { RoutingStateRepository } from '../../../infrastructure/db/repositories/routing-state.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';

export interface ResilienceRouteDeps {
  db: Db;
}

export async function resilienceRoutes(
  app: FastifyInstance,
  deps: ResilienceRouteDeps,
): Promise<void> {
  const repo = new RoutingStateRepository(deps.db);

  app.get('/breakers', async () => {
    const breakers = await repo.listBreakers();
    return listBreakersResponseSchema.parse({ data: serializeForContract(breakers) });
  });

  app.post('/breakers/:upstreamKeyId/:realModelName/reset', async (req) => {
    const { upstreamKeyId, realModelName } = req.params as {
      upstreamKeyId: string;
      realModelName: string;
    };
    const existing = await repo.findBreaker(upstreamKeyId, realModelName);
    if (!existing) {
      const created = await repo.upsertBreaker({
        upstreamKeyId,
        realModelName,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        openCount: 0,
        cooldownUntil: null,
        openedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      return resetBreakerResponseSchema.parse({ data: serializeForContract(created) });
    }
    const reset = await repo.updateBreakerState(upstreamKeyId, realModelName, 'closed', {
      failureCount: 0,
      successCount: 0,
      cooldownUntil: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    return resetBreakerResponseSchema.parse({ data: serializeForContract(reset) });
  });

  app.get('/sticky', async (req) => {
    const query = stickyQuerySchema.parse(req.query);
    const [bindings, sessions] = await Promise.all([
      repo.listStickyBindings({
        consumerKeyId: query.consumerKeyId,
        requestedTargetName: query.requestedTargetName,
      }),
      repo.listStickySessions({
        consumerKeyId: query.consumerKeyId,
        requestedTargetName: query.requestedTargetName,
      }),
    ]);
    return stickyOverviewResponseSchema.parse({
      data: serializeForContract({ bindings, sessions }),
    });
  });
}
