import 'fastify';
import type { ConsumerKeyRow, AppRow } from '../../infrastructure/db/schema.js';

declare module 'fastify' {
  interface FastifyRequest {
    consumerKey?: ConsumerKeyRow;
    app?: AppRow;
    requestTraceId?: string;
  }
}
