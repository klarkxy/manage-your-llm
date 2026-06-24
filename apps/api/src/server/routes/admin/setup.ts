import type { FastifyInstance } from 'fastify';
import {
  setupStatusResponseSchema,
  setupSecurityRequestSchema,
  setupSecurityResponseSchema,
  setupUpstreamRequestSchema,
  setupUpstreamResponseSchema,
  setupModelsRequestSchema,
  setupModelsResponseSchema,
  setupConsumerKeyResponseSchema,
  setupTestRequestQuerySchema,
  setupTestRequestResponseSchema,
} from '@manageyourllm/contracts';
import { SetupService } from '../../../application/setup.service.js';
import type { Db } from '../../../infrastructure/db/client.js';

export interface SetupRouteDeps {
  db: Db;
  secretKey: string;
  publicBaseUrl: string;
}

export async function setupRoutes(app: FastifyInstance, deps: SetupRouteDeps): Promise<void> {
  const service = new SetupService(deps.db, deps.secretKey);

  app.get('/status', async () => {
    const status = await service.getStatus();
    return setupStatusResponseSchema.parse({ data: status });
  });

  app.post('/security', async (req) => {
    const body = setupSecurityRequestSchema.parse(req.body);
    const ok = await service.verifySecurity(body.username, body.password);
    return setupSecurityResponseSchema.parse({ data: { ok } });
  });

  app.post('/upstream', async (req) => {
    const body = setupUpstreamRequestSchema.parse(req.body);
    const result = await service.createUpstream(body);
    return setupUpstreamResponseSchema.parse({ data: result });
  });

  app.post('/models', async (req) => {
    const body = setupModelsRequestSchema.parse(req.body);
    const result = await service.createModels(body.models);
    return setupModelsResponseSchema.parse({ data: result });
  });

  app.post('/consumer-key', async () => {
    const result = await service.createDefaultConsumerKey();
    return setupConsumerKeyResponseSchema.parse({ data: result });
  });

  app.get('/test-request', async (req) => {
    const query = setupTestRequestQuerySchema.parse(req.query);
    const status = await service.getStatus();
    if (!status.hasConsumerKey) {
      return setupTestRequestResponseSchema.parse({ data: { curl: '' } });
    }
    // 简化：从 settings 或环境取 baseUrl；当前使用 publicBaseUrl。
    const curl = service.generateTestRequest(
      deps.publicBaseUrl,
      '<your-consumer-key>',
      query.model,
    );
    return setupTestRequestResponseSchema.parse({ data: { curl } });
  });
}
