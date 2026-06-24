import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listPresetsResponseSchema,
  presetResponseSchema,
  createLocalPresetRequestSchema,
  updateLocalPresetRequestSchema,
  successEnvelope,
} from '@manageyourllm/contracts';
import { ProviderPresetRepository } from '../../../infrastructure/db/repositories/provider-preset.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';

export interface ProviderPresetRouteDeps {
  db: Db;
}

export async function providerPresetRoutes(
  app: FastifyInstance,
  deps: ProviderPresetRouteDeps,
): Promise<void> {
  const repo = new ProviderPresetRepository(deps.db);

  app.get('/', async () => {
    const presets = await repo.listAll();
    return listPresetsResponseSchema.parse({ data: serializeForContract(presets) });
  });

  app.post('/', async (req) => {
    const body = createLocalPresetRequestSchema.parse(req.body);
    const preset = await repo.createLocal({
      name: body.name,
      providerType: body.providerType as never,
      descriptorJson: body.descriptorJson as never,
    });
    return presetResponseSchema.parse({ data: serializeForContract(preset) });
  });

  app.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updateLocalPresetRequestSchema.parse(req.body);
    const preset = await repo.updateLocal(id, {
      name: body.name,
      providerType: body.providerType as never,
      descriptorJson: body.descriptorJson as never,
    });
    return presetResponseSchema.parse({ data: serializeForContract(preset) });
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await repo.deleteLocal(id);
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });
}
