import type { FastifyInstance } from 'fastify';
import { settingsResponseSchema, updateSettingsRequestSchema } from '@manageyourllm/contracts';
import { SettingsService } from '../../../domain/settings/settings.service.js';
import { serializeForContract } from '../../helpers/contract-serializer.js';
import type { Db } from '../../../infrastructure/db/client.js';

export interface SettingsRouteDeps {
  db: Db;
}

export async function settingsRoutes(app: FastifyInstance, deps: SettingsRouteDeps): Promise<void> {
  const service = new SettingsService(deps.db);

  app.get('/', async () => {
    const settings = await service.getSettings();
    return settingsResponseSchema.parse({ data: serializeForContract(settings) });
  });

  app.patch('/', async (req) => {
    const body = updateSettingsRequestSchema.parse(req.body);
    const settings = await service.updateSettings({
      publicBaseUrl: body.publicBaseUrl,
      gatewayBasePath: body.gatewayBasePath,
      defaultRequestTimeoutMs: body.defaultRequestTimeoutMs,
      defaultRetries: body.defaultRetries,
      enableStickySession: body.enableStickySession,
      enableCircuitBreaker: body.enableCircuitBreaker,
    });
    return settingsResponseSchema.parse({ data: serializeForContract(settings) });
  });
}
