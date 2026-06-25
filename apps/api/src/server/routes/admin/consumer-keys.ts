import type { FastifyInstance } from 'fastify';
import {
  listConsumerKeysResponseSchema,
  consumerKeyResponseSchema,
  createConsumerKeyResponseSchema,
  revokeConsumerKeyResponseSchema,
  createConsumerKeyRequestSchema,
  updateConsumerKeyRequestSchema,
  rotateConsumerKeyResponseSchema,
  successEnvelope,
} from '@manageyourllm/contracts';
import { ConsumerKeyService } from '../../../domain/identity-access/consumer-key.service.js';
import { ConsumerKeyRepository } from '../../../infrastructure/db/repositories/consumer-key.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { z } from 'zod';

export interface ConsumerKeyRouteDeps {
  db: Db;
}

export async function consumerKeyRoutes(
  app: FastifyInstance,
  deps: ConsumerKeyRouteDeps,
): Promise<void> {
  const service = new ConsumerKeyService(deps.db);
  const repo = new ConsumerKeyRepository(deps.db);

  app.get('/', async () => {
    const keys = await repo.listAll();
    return listConsumerKeysResponseSchema.parse({ data: serializeForContract(keys) });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const key = await repo.findByIdWithAccess(id);
    return consumerKeyResponseSchema.parse({ data: serializeForContract(key) });
  });

  app.post('/', async (req) => {
    const body = createConsumerKeyRequestSchema.parse(req.body);
    const result = await service.createConsumerKey({
      appId: body.appId,
      name: body.name,
      accessMode: body.accessMode ?? 'all',
      accessTargets: body.accessTargets,
      enabled: body.enabled ?? true,
    });
    const withAccess = await repo.findByIdWithAccess(result.consumerKey.id);
    return createConsumerKeyResponseSchema.parse({
      data: serializeForContract({ consumerKey: withAccess!, rawKey: result.rawKey }),
    });
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updateConsumerKeyRequestSchema.parse(req.body);
    const key = await repo.updateConsumerKey(id, {
      name: body.name,
      accessMode: body.accessMode,
      enabled: body.enabled,
    });
    if (body.accessTargets && body.accessMode === 'restricted') {
      await repo.replaceAccess(
        id,
        body.accessTargets.map((t) => ({ targetType: t.targetType, targetId: t.targetId })),
      );
    } else if (body.accessMode === 'all') {
      await repo.deleteAccessByConsumerKey(id);
    }
    const withAccess = await repo.findByIdWithAccess(key!.id);
    return consumerKeyResponseSchema.parse({ data: serializeForContract(withAccess) });
  });

  app.post('/:id/rotate', async (req) => {
    const { id } = req.params as { id: string };
    const result = await service.rotateConsumerKey(id);
    return rotateConsumerKeyResponseSchema.parse({
      data: serializeForContract({ consumerKey: result.consumerKey, rawKey: result.rawKey }),
    });
  });

  app.post('/:id/revoke', async (req) => {
    const { id } = req.params as { id: string };
    const key = await service.revokeConsumerKey(id);
    const withAccess = await repo.findByIdWithAccess(key!.id);
    return revokeConsumerKeyResponseSchema.parse({
      data: serializeForContract({ consumerKey: withAccess! }),
    });
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await repo.deleteConsumerKey(id);
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });
}
