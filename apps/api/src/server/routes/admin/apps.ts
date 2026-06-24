import type { FastifyInstance } from 'fastify';
import {
  listAppsResponseSchema,
  appResponseSchema,
  createAppRequestSchema,
  updateAppRequestSchema,
  successEnvelope,
} from '@manageyourllm/contracts';
import { AppRepository } from '../../../infrastructure/db/repositories/app.repository.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { z } from 'zod';

export interface AppRouteDeps {
  db: Db;
}

export async function appRoutes(app: FastifyInstance, deps: AppRouteDeps): Promise<void> {
  const repo = new AppRepository(deps.db);

  app.get('/', async () => {
    const apps = await repo.listApps();
    return listAppsResponseSchema.parse({ data: serializeForContract(apps) });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const item = await repo.findById(id);
    return appResponseSchema.parse({ data: serializeForContract(item) });
  });

  app.post('/', async (req) => {
    const body = createAppRequestSchema.parse(req.body);
    const item = await repo.createApp({
      name: body.name,
      description: body.description ?? null,
      enabled: body.enabled ?? true,
    });
    return appResponseSchema.parse({ data: serializeForContract(item) });
  });

  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updateAppRequestSchema.parse(req.body);
    const item = await repo.updateApp(id, {
      name: body.name,
      description: body.description ?? undefined,
      enabled: body.enabled,
    });
    return appResponseSchema.parse({ data: serializeForContract(item) });
  });

  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await repo.deleteApp(id);
    return successEnvelope(z.object({ ok: z.boolean() })).parse({ data: { ok: true } });
  });
}
