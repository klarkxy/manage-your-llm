import type { FastifyInstance } from 'fastify';
import {
  listModelGroupsResponseSchema,
  modelGroupResponseSchema,
  createModelGroupRequestSchema,
  updateModelGroupRequestSchema,
  replaceMembersRequestSchema,
  successEnvelope,
} from '@manageyourllm/contracts';
import { ModelGroupService } from '../../../domain/model-catalog/model-group.service.js';
import { ModelGroupRepository } from '../../../infrastructure/db/repositories/model-group.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { z } from 'zod';

export interface ModelGroupRouteDeps {
  db: Db;
}

export async function modelGroupRoutes(app: FastifyInstance, deps: ModelGroupRouteDeps): Promise<void> {
  const service = new ModelGroupService(deps.db);
  const repo = new ModelGroupRepository(deps.db);

  app.get('/', async () => {
    const groups = await repo.listModelGroups();
    return listModelGroupsResponseSchema.parse({ data: serializeForContract(groups) });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const group = await repo.findWithMembers(id);
    return modelGroupResponseSchema.parse({ data: serializeForContract(group) });
  });

  app.post('/', async (req) => {
    const body = createModelGroupRequestSchema.parse(req.body);
    const group = await service.createModelGroup({
      name: body.name,
      displayName: body.displayName,
      description: body.description,
      enabled: body.enabled,
      members: body.members,
    });
    const withMembers = await repo.findWithMembers(group.id);
    return modelGroupResponseSchema.parse({ data: serializeForContract(withMembers) });
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updateModelGroupRequestSchema.parse(req.body);
    const group = await service.updateModelGroup(id, {
      name: body.name,
      displayName: body.displayName,
      description: body.description,
      enabled: body.enabled,
    });
    const withMembers = await repo.findWithMembers(group!.id);
    return modelGroupResponseSchema.parse({ data: serializeForContract(withMembers) });
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await service.deleteModelGroup(id);
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });

  app.post('/:id/members/replace', async (req) => {
    const { id } = req.params as { id: string };
    const body = replaceMembersRequestSchema.parse(req.body);
    await repo.replaceMembers(
      id,
      body.members.map((m) => ({
        publicModelId: m.publicModelId,
        enabled: m.enabled,
        priority: m.priority,
        weight: m.weight,
      })),
    );
    const withMembers = await repo.findWithMembers(id);
    return modelGroupResponseSchema.parse({ data: serializeForContract(withMembers) });
  });
}
