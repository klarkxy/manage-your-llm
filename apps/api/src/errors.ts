import type { FastifyInstance } from 'fastify';
import {
  AuthenticationError,
  NoRouteAvailableError,
  PermissionError,
  ProviderError,
  ProviderQuotaError,
  ProviderRateLimitError,
  ProviderStreamError,
  ProviderTimeoutError,
  TargetNotFoundError,
  ValidationError,
  isNormalizedError,
} from '@modelharbor/shared';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, req, reply) => {
    if (isNormalizedError(err)) {
      reply.status(statusFor(err)).send(err.toClientShape());
      return;
    }
    req.log.error({ err }, 'unhandled error');
    reply.status(500).send({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        code: 'internal_error',
      },
    });
  });
}

function statusFor(err: unknown): number {
  if (err instanceof AuthenticationError) return 401;
  if (err instanceof PermissionError) return 403;
  if (err instanceof TargetNotFoundError) return 404;
  if (err instanceof ValidationError) return 400;
  if (err instanceof NoRouteAvailableError) return 503;
  if (err instanceof ProviderRateLimitError) return 429;
  if (
    err instanceof ProviderError ||
    err instanceof ProviderQuotaError ||
    err instanceof ProviderTimeoutError ||
    err instanceof ProviderStreamError
  ) {
    return 502;
  }
  return 500;
}
