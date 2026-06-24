export class NormalizedError extends Error {
  readonly code: string;
  readonly type: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.type = this.constructor.name;
    if (details !== undefined) {
      this.details = details;
    }
  }

  toClientShape(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      error: {
        message: this.message,
        type: this.type,
        code: this.code,
      },
    };
    if (this.details !== undefined) {
      (body.error as Record<string, unknown>).details = this.details;
    }
    return body;
  }
}

export class ValidationError extends NormalizedError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super('validation_error', message, details);
  }
}

export class AuthenticationError extends NormalizedError {
  constructor(message = 'Authentication failed', details?: Record<string, unknown>) {
    super('authentication_error', message, details);
  }
}

export class PermissionError extends NormalizedError {
  constructor(message = 'Permission denied', details?: Record<string, unknown>) {
    super('permission_error', message, details);
  }
}

export class TargetNotFoundError extends NormalizedError {
  constructor(message = 'Target not found', details?: Record<string, unknown>) {
    super('target_not_found', message, details);
  }
}

export class NoRouteAvailableError extends NormalizedError {
  constructor(message = 'No available upstream route', details?: Record<string, unknown>) {
    super('no_route_available', message, details);
  }
}

export class ProviderError extends NormalizedError {
  constructor(message = 'Upstream provider error', details?: Record<string, unknown>) {
    super('provider_error', message, details);
  }
}

export class ProviderRateLimitError extends NormalizedError {
  constructor(message = 'Upstream rate limit', details?: Record<string, unknown>) {
    super('provider_rate_limit', message, details);
  }
}

export class ProviderQuotaError extends NormalizedError {
  constructor(message = 'Upstream quota exhausted', details?: Record<string, unknown>) {
    super('provider_quota_exhausted', message, details);
  }
}

export class ProviderTimeoutError extends NormalizedError {
  constructor(message = 'Upstream timeout', details?: Record<string, unknown>) {
    super('provider_timeout', message, details);
  }
}

export class ProviderStreamError extends NormalizedError {
  constructor(message = 'Upstream stream error', details?: Record<string, unknown>) {
    super('provider_stream_error', message, details);
  }
}

export function isNormalizedError(err: unknown): err is NormalizedError {
  return err instanceof NormalizedError;
}
