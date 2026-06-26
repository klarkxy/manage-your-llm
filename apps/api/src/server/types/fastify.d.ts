import 'fastify';
import type { ConsumerKeyRow, AppRow } from '../../infrastructure/db/schema.js';
import type { SourceProtocol } from '@manageyourllm/shared';

declare module 'fastify' {
  interface FastifyRequest {
    consumerKey?: ConsumerKeyRow;
    app?: AppRow;
    requestTraceId?: string;
    sourceProtocol?: SourceProtocol;
    requestStartTime?: number;
  }
}
