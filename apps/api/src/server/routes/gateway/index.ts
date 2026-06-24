import type { FastifyInstance, FastifyRequest } from 'fastify';
import { GatewayExecutionService } from '../../../application/gateway-execution.service.js';
import { TargetResolutionService } from '../../../domain/gateway/target-resolution.service.js';
import { AccessPolicyService } from '../../../domain/identity-access/access-policy.service.js';
import { parseAnthropicMessages } from '../../../gateway/parsers/anthropic.js';
import { parseOpenAIChatCompletions } from '../../../gateway/parsers/openai-chat.js';
import { parseOpenAIResponses } from '../../../gateway/parsers/openai-responses.js';
import { gatewayAuthGuardHook } from '../../plugins/gateway-auth.js';
import type { Db } from '../../../infrastructure/db/client.js';

export interface GatewayRouteDeps {
  db: Db;
  prefix?: string;
}

function assertAuthenticated(
  req: FastifyRequest,
): { consumerKey: NonNullable<FastifyRequest['consumerKey']>; app: NonNullable<FastifyRequest['app']>; requestTraceId: string } {
  if (!req.consumerKey || !req.app || !req.requestTraceId) {
    throw new Error('网关认证信息缺失');
  }
  return { consumerKey: req.consumerKey, app: req.app, requestTraceId: req.requestTraceId };
}

export async function gatewayRoutes(app: FastifyInstance, deps: GatewayRouteDeps): Promise<void> {
  app.addHook('preHandler', async (req) => gatewayAuthGuardHook(req, undefined, { db: deps.db }));

  const executionService = new GatewayExecutionService();

  app.get('/models', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const result = await executionService.listModels({ db: deps.db, ...ctx });
    return reply.send({ data: result });
  });

  app.post('/messages', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const ir = parseAnthropicMessages(req.body);
    const resolved = await new TargetResolutionService(deps.db).resolve(ir.requestedModel);
    await new AccessPolicyService(deps.db).checkAccess(ctx.consumerKey, ir.requestedModel);
    return reply.status(501).send({
      error: {
        message: 'Anthropic Messages chat completion is not implemented yet',
        type: 'not_implemented',
        code: 'not_implemented',
        target: resolved.name,
      },
    });
  });

  app.post('/chat/completions', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const ir = parseOpenAIChatCompletions(req.body);
    const resolved = await new TargetResolutionService(deps.db).resolve(ir.requestedModel);
    await new AccessPolicyService(deps.db).checkAccess(ctx.consumerKey, ir.requestedModel);
    return reply.status(501).send({
      error: {
        message: 'OpenAI Chat Completions is not implemented yet',
        type: 'not_implemented',
        code: 'not_implemented',
        target: resolved.name,
      },
    });
  });

  app.post('/responses', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const ir = parseOpenAIResponses(req.body);
    const resolved = await new TargetResolutionService(deps.db).resolve(ir.requestedModel);
    await new AccessPolicyService(deps.db).checkAccess(ctx.consumerKey, ir.requestedModel);
    return reply.status(501).send({
      error: {
        message: 'OpenAI Responses is not implemented yet',
        type: 'not_implemented',
        code: 'not_implemented',
        target: resolved.name,
      },
    });
  });
}
