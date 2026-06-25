import type { FastifyInstance } from 'fastify';
import {
  listUpstreamKeysResponseSchema,
  upstreamKeyResponseSchema,
  createUpstreamKeyRequestSchema,
  updateUpstreamKeyRequestSchema,
  rotateApiKeyRequestSchema,
  rotateApiKeyResponseSchema,
  reorderUpstreamKeysRequestSchema,
  freezeUpstreamKeyRequestSchema,
  discoverModelsResponseSchema,
  pingUpstreamRequestSchema,
  pingUpstreamResponseSchema,
  successEnvelope,
} from '@manageyourllm/contracts';
import { UpstreamKeyService } from '../../../application/upstream-key.service.js';
import { UpstreamProbeService } from '../../../application/upstream-probe.service.js';
import { EndpointHealthWorker } from '../../../application/endpoint-health-worker.js';
import { UpstreamKeyRepository } from '../../../infrastructure/db/repositories/upstream-key.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import { stripUpstreamKeySecrets } from './upstream-key-strip.js';
import type { Db } from '../../../infrastructure/db/client.js';
import type { UpstreamKeyRow, UpstreamKeyQuotaRow } from '../../../infrastructure/db/schema.js';
import { z } from 'zod';

export interface UpstreamKeyRouteDeps {
  db: Db;
  secretKey: string;
}

type UpstreamResponse = Omit<UpstreamKeyRow, 'apiKeyCiphertext' | 'authConfigCiphertext'> & {
  quota?: UpstreamKeyQuotaRow | null;
};

async function buildUpstreamResponse(
  upstream: UpstreamKeyRow,
  repo: UpstreamKeyRepository,
): Promise<UpstreamResponse> {
  const quota = await repo.findQuotaByUpstreamKey(upstream.id);
  return stripUpstreamKeySecrets({ ...upstream, quota: quota ?? null });
}

export async function upstreamKeyRoutes(
  app: FastifyInstance,
  deps: UpstreamKeyRouteDeps,
): Promise<void> {
  const service = new UpstreamKeyService(deps.db, deps.secretKey);
  const probe = new UpstreamProbeService({ db: deps.db, secretKey: deps.secretKey });
  const healthWorker = new EndpointHealthWorker({ db: deps.db, secretKey: deps.secretKey });
  const repo = new UpstreamKeyRepository(deps.db);

  app.get('/', async () => {
    const keys = await repo.listUpstreamKeys();
    const withQuotas = await Promise.all(keys.map((k) => buildUpstreamResponse(k, repo)));
    return listUpstreamKeysResponseSchema.parse({ data: serializeForContract(withQuotas) });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const key = await repo.findById(id);
    if (!key) {
      return upstreamKeyResponseSchema.parse({ data: null });
    }
    return upstreamKeyResponseSchema.parse({
      data: serializeForContract(await buildUpstreamResponse(key, repo)),
    });
  });

  app.post('/', async (req) => {
    const body = createUpstreamKeyRequestSchema.parse(req.body);
    const key = await service.createUpstreamKey(body as never);
    return upstreamKeyResponseSchema.parse({
      data: serializeForContract(await buildUpstreamResponse(key, repo)),
    });
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updateUpstreamKeyRequestSchema.parse(req.body);
    const key = await service.updateUpstreamKey(id, body as never);
    if (!key) {
      return upstreamKeyResponseSchema.parse({ data: null });
    }
    return upstreamKeyResponseSchema.parse({
      data: serializeForContract(await buildUpstreamResponse(key, repo)),
    });
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteUpstreamKey(id);
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });

  app.post('/:id/rotate', async (req) => {
    const { id } = req.params as { id: string };
    const body = rotateApiKeyRequestSchema.parse(req.body);
    const key = await service.rotateApiKey(id, body.apiKey);
    if (!key) {
      return rotateApiKeyResponseSchema.parse({ data: null });
    }
    const safe = stripUpstreamKeySecrets(key);
    return rotateApiKeyResponseSchema.parse({ data: serializeForContract(safe) });
  });

  app.post('/:id/freeze', async (req) => {
    const { id } = req.params as { id: string };
    const body = freezeUpstreamKeyRequestSchema.parse(req.body);
    const key = await service.freezeUpstreamKey(id, body.frozen, body.reason);
    if (!key) {
      return upstreamKeyResponseSchema.parse({ data: null });
    }
    return upstreamKeyResponseSchema.parse({
      data: serializeForContract(await buildUpstreamResponse(key, repo)),
    });
  });

  app.post('/:id/unfreeze', async (req) => {
    const { id } = req.params as { id: string };
    const key = await service.freezeUpstreamKey(id, false);
    if (!key) {
      return upstreamKeyResponseSchema.parse({ data: null });
    }
    return upstreamKeyResponseSchema.parse({
      data: serializeForContract(await buildUpstreamResponse(key, repo)),
    });
  });

  app.post('/reorder', async (req) => {
    const body = reorderUpstreamKeysRequestSchema.parse(req.body);
    for (const item of body) {
      await repo.updateUpstreamKey(item.id, { displayOrder: item.displayOrder });
    }
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });

  app.post('/:id/discover', async (req) => {
    const { id } = req.params as { id: string };
    const models = await probe.discoverModels(id);
    return discoverModelsResponseSchema.parse({ data: serializeForContract(models) });
  });

  app.post('/:id/ping', async (req) => {
    const { id } = req.params as { id: string };
    const body = pingUpstreamRequestSchema.parse(req.body ?? {});
    const result = await probe.ping(id, body.model);
    const upstream = await repo.findById(id);
    if (upstream) {
      await healthWorker.recordPingResult(upstream, result);
    }
    return pingUpstreamResponseSchema.parse({ data: serializeForContract(result) });
  });
}
