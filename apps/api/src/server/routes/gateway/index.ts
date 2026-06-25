import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { GatewayExecutionService } from '../../../application/gateway-execution.service.js';
import { parseAnthropicMessages } from '../../../gateway/parsers/anthropic.js';
import { parseOpenAIChatCompletions } from '../../../gateway/parsers/openai-chat.js';
import { parseOpenAIResponses } from '../../../gateway/parsers/openai-responses.js';
import { gatewayAuthGuardHook } from '../../plugins/gateway-auth.js';
import type { Db } from '../../../infrastructure/db/client.js';

export interface GatewayRouteDeps {
  db: Db;
  secretKey: string;
  prefix?: string;
}

function assertAuthenticated(req: FastifyRequest): {
  consumerKey: NonNullable<FastifyRequest['consumerKey']>;
  app: NonNullable<FastifyRequest['app']>;
  requestTraceId: string;
} {
  if (!req.consumerKey || !req.app || !req.requestTraceId) {
    throw new Error('网关认证信息缺失');
  }
  return { consumerKey: req.consumerKey, app: req.app, requestTraceId: req.requestTraceId };
}

export async function gatewayRoutes(app: FastifyInstance, deps: GatewayRouteDeps): Promise<void> {
  app.addHook('preHandler', async (req) => gatewayAuthGuardHook(req, undefined, { db: deps.db }));

  const executionService = new GatewayExecutionService({ db: deps.db, secretKey: deps.secretKey });

  app.get('/models', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const result = await executionService.listModels({ db: deps.db, ...ctx });
    return reply.send({ data: result });
  });

  app.post('/messages', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const ir = parseAnthropicMessages(req.body);
    if (ir.stream) {
      const result = await executionService.executeStream({ db: deps.db, ...ctx }, ir);
      return reply
        .status(result.status)
        .headers(result.headers)
        .send(Readable.fromWeb(result.stream));
    }
    const { status, body } = await executionService.executeChat({ db: deps.db, ...ctx }, ir);
    return reply.status(status).send(body);
  });

  app.post('/chat/completions', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const ir = parseOpenAIChatCompletions(req.body);
    if (ir.stream) {
      const result = await executionService.executeStream({ db: deps.db, ...ctx }, ir);
      return reply
        .status(result.status)
        .headers(result.headers)
        .send(Readable.fromWeb(result.stream));
    }
    const { status, body } = await executionService.executeChat({ db: deps.db, ...ctx }, ir);
    return reply.status(status).send(body);
  });

  app.post('/responses', async (req, reply) => {
    const ctx = assertAuthenticated(req);
    const ir = parseOpenAIResponses(req.body);
    if (ir.stream) {
      const result = await executionService.executeStream({ db: deps.db, ...ctx }, ir);
      return reply
        .status(result.status)
        .headers(result.headers)
        .send(Readable.fromWeb(result.stream));
    }
    const { status, body } = await executionService.executeChat({ db: deps.db, ...ctx }, ir);
    return reply.status(status).send(body);
  });
}
