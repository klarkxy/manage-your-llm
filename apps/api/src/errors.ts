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
    // Map well-known driver-level errors to actionable client responses before
    // falling back to the generic 500. Right now the only one we see in
    // practice is a UNIQUE constraint failure on libsql/SQLite — surface which
    // table/index tripped so the admin can see what they double-submitted.
    if (isLibsqlUniqueError(err)) {
      req.log.warn({ err }, 'uniqueness conflict');
      reply.status(409).send({
        error: {
          message: `uniqueness conflict: ${err.message.split('\n')[0]}`,
          type: 'uniqueness_conflict',
          code: 'uniqueness_conflict',
        },
      });
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

function isLibsqlUniqueError(err: unknown): err is Error & { code: string; rawCode?: number } {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; rawCode?: unknown; name?: unknown };
  return (
    e.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    (e.name === 'LibsqlError' && e.rawCode === 2067)
  );
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
