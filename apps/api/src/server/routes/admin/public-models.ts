import type { FastifyInstance } from 'fastify';
import {
  listPublicModelsResponseSchema,
  publicModelResponseSchema,
  createPublicModelRequestSchema,
  updatePublicModelRequestSchema,
  reorderCandidatesRequestSchema,
  successEnvelope,
} from '@manageyourllm/contracts';
import { PublicModelService } from '../../../domain/model-catalog/public-model.service.js';
import { PublicModelRepository } from '../../../infrastructure/db/repositories/public-model.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { z } from 'zod';

export interface PublicModelRouteDeps {
  db: Db;
}

export async function publicModelRoutes(
  app: FastifyInstance,
  deps: PublicModelRouteDeps,
): Promise<void> {
  const service = new PublicModelService(deps.db);
  const repo = new PublicModelRepository(deps.db);

  app.get('/', async () => {
    const models = await repo.listPublicModels();
    return listPublicModelsResponseSchema.parse({ data: serializeForContract(models) });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const model = await repo.findWithCandidates(id);
    return publicModelResponseSchema.parse({ data: serializeForContract(model) });
  });

  app.post('/', async (req) => {
    const body = createPublicModelRequestSchema.parse(req.body);
    const model = await service.createPublicModel({
      name: body.name,
      displayName: body.displayName,
      description: body.description,
      enabled: body.enabled,
      candidates: body.candidates,
    });
    const withCandidates = await repo.findWithCandidates(model.id);
    return publicModelResponseSchema.parse({ data: serializeForContract(withCandidates) });
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updatePublicModelRequestSchema.parse(req.body);
    const model = await service.updatePublicModel(id, {
      name: body.name,
      displayName: body.displayName,
      description: body.description,
      enabled: body.enabled,
    });
    const withCandidates = await repo.findWithCandidates(model!.id);
    return publicModelResponseSchema.parse({ data: serializeForContract(withCandidates) });
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deletePublicModel(id);
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });

  app.post('/:id/candidates/reorder', async (req) => {
    const { id } = req.params as { id: string };
    const body = reorderCandidatesRequestSchema.parse(req.body);
    for (const item of body) {
      await repo.updateCandidate(item.candidateId, { priority: item.priority });
    }
    const withCandidates = await repo.findWithCandidates(id);
    return publicModelResponseSchema.parse({ data: serializeForContract(withCandidates) });
  });
}
