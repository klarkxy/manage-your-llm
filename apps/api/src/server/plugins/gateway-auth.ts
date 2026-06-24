import type { FastifyInstance, FastifyRequest } from 'fastify';
import { generateId } from '@manageyourllm/shared';
import { AuthenticationError } from '@manageyourllm/shared';
import { ConsumerKeyService } from '../../domain/identity-access/consumer-key.service.js';
import { AppRepository } from '../../infrastructure/db/repositories/app.repository.js';
import type { Db } from '../../infrastructure/db/client.js';

export interface GatewayAuthPluginDeps {
  db: Db;
}

function extractBearerToken(header: unknown): string | undefined {
  if (typeof header !== 'string') return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function extractRawKey(req: FastifyRequest): string | undefined {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];
  return extractBearerToken(authHeader) ?? (typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined);
}

export async function gatewayAuthGuardHook(
  req: FastifyRequest,
  _reply: unknown,
  deps: GatewayAuthPluginDeps,
): Promise<void> {
  const rawKey = extractRawKey(req);
  if (!rawKey) {
    throw new AuthenticationError('缺少 consumer key');
  }

  const consumerKeyService = new ConsumerKeyService(deps.db);
  const consumerKey = await consumerKeyService.verifyRawKey(rawKey);
  if (!consumerKey) {
    throw new AuthenticationError('无效的 consumer key');
  }
  if (consumerKey.revokedAt) {
    throw new AuthenticationError('consumer key 已吊销');
  }

  const app = await new AppRepository(deps.db).findById(consumerKey.appId);
  if (!app || !app.enabled) {
    throw new AuthenticationError('应用已禁用');
  }

  req.consumerKey = consumerKey;
  req.app = app;
  req.requestTraceId = generateId('trace');
}

export async function gatewayAuthPlugin(
  app: FastifyInstance,
  deps: GatewayAuthPluginDeps,
): Promise<void> {
  app.addHook('preHandler', async (req) => gatewayAuthGuardHook(req, undefined, deps));
}

export function registerGatewayAuthGuard(app: FastifyInstance, deps: GatewayAuthPluginDeps): void {
  app.addHook('preHandler', async (req) => gatewayAuthGuardHook(req, undefined, deps));
}
