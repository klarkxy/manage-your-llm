import {
  ProviderError,
  ProviderRateLimitError,
  ProviderQuotaError,
  ProviderTimeoutError,
  NormalizedError,
} from '@modelharbor/shared';
import type {
  NormalizedProviderError,
  ProviderErrorContext,
  ProviderHttpResponse,
} from './types.js';

// Read JSON if the body looks like JSON, else null.
export function safeJsonParse(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Inspect an HTTP error body and classify it. Returns null if the response
// is not actually an error (status 2xx) or the body is unrecognizable.
export function classifyHttpError(
  status: number,
  bodyJson: unknown,
  bodyText: string,
  providerMessage: string | null,
  providerCode: string | null,
): NormalizedProviderError['category'] | null {
  if (status >= 200 && status < 300) return null;

  // OpenAI-style: error.code / error.type
  // Anthropic-style: error.type
  const code = (() => {
    if (bodyJson && typeof bodyJson === 'object' && 'error' in bodyJson) {
      const err = (bodyJson as { error?: unknown }).error;
      if (err && typeof err === 'object') {
        const obj = err as Record<string, unknown>;
        if (typeof obj['code'] === 'string') return obj['code'].toLowerCase();
        if (typeof obj['type'] === 'string') return obj['type'].toLowerCase();
      }
    }
    if (providerCode) return providerCode.toLowerCase();
    return '';
  })();

  // Code-based classification FIRST. The provider error code (e.g. "model_not_found",
  // "insufficient_quota") is more specific than the HTTP status, and several
  // providers (Anthropic, OpenAI) use 400/422 with a code like
  // "model_not_found" or "insufficient_credit" — the old order would have
  // returned "provider_bad_request" before reaching the code check.
  if (code.includes('rate_limit') || code.includes('ratelimit') || code.includes('too_many')) {
    return 'provider_rate_limit';
  }
  if (
    code.includes('quota') ||
    code.includes('insufficient') ||
    code.includes('credit') ||
    code.includes('billing') ||
    code.includes('payment')
  ) {
    return 'provider_quota';
  }
  if (code.includes('timeout') || code.includes('timed_out') || code.includes('deadline')) {
    return 'provider_timeout';
  }
  if (code.includes('model_not_found') || code.includes('model_not_exists')) {
    return 'provider_model_not_found';
  }
  if (code.includes('auth') || code.includes('api_key') || code.includes('unauthorized')) {
    return 'provider_authentication';
  }
  if (code.includes('permission') || code.includes('forbidden')) {
    return 'provider_permission';
  }
  if (code.includes('overloaded') || code.includes('capacity')) {
    return 'provider_overloaded';
  }

  // Status code fallback. Only used when no specific code matched.
  if (status === 401) return 'provider_authentication';
  if (status === 403) return 'provider_permission';
  if (status === 404) return 'provider_model_not_found';
  if (status === 408 || status === 504 || status === 524) return 'provider_timeout';
  if (status === 429) return 'provider_rate_limit';
  if (status === 503) return 'provider_overloaded';
  if (status >= 500) return 'provider_unknown';

  // 4xx that did not match a code-specific case is a generic bad request.
  if (status >= 400 && status < 500) return 'provider_bad_request';
  return 'provider_unknown';
}

export function emptyProviderError(): NormalizedProviderError {
  return {
    category: 'provider_unknown',
    providerMessage: null,
    providerCode: null,
    upstreamStatus: 0,
  };
}

// Convert a NormalizedProviderError to a NormalizedError class for the
// response. The router uses these classes to pick a final HTTP status.
export function providerErrorToNormalized(err: NormalizedProviderError): NormalizedError {
  switch (err.category) {
    case 'provider_rate_limit':
      return new ProviderRateLimitError(err.providerMessage ?? 'rate limited');
    case 'provider_quota':
      return new ProviderQuotaError(err.providerMessage ?? 'quota exhausted');
    case 'provider_timeout':
      return new ProviderTimeoutError(err.providerMessage ?? 'upstream timeout');
    case 'provider_stream_error':
    case 'provider_authentication':
    case 'provider_permission':
    case 'provider_model_not_found':
    case 'provider_bad_request':
    case 'provider_overloaded':
    case 'provider_unknown':
      return new ProviderError(err.providerMessage ?? 'upstream error');
  }
}

// Pull the provider's own message and code out of the error body. Most providers
// use one of two shapes: OpenAI's `error: {message, code, type}` and
// Anthropic's `error: {type, message}`. We support both plus a few ad-hoc ones.
export function extractProviderErrorFields(bodyJson: unknown): {
  message: string | null;
  code: string | null;
} {
  if (!bodyJson || typeof bodyJson !== 'object') return { message: null, code: null };
  const obj = bodyJson as Record<string, unknown>;
  if ('error' in obj && obj['error'] && typeof obj['error'] === 'object') {
    const err = obj['error'] as Record<string, unknown>;
    return {
      message: typeof err['message'] === 'string' ? (err['message'] as string) : null,
      code:
        typeof err['code'] === 'string'
          ? (err['code'] as string)
          : typeof err['type'] === 'string'
            ? (err['type'] as string)
            : null,
    };
  }
  if (typeof obj['message'] === 'string') {
    return { message: obj['message'] as string, code: null };
  }
  return { message: null, code: null };
}

// Try to read a response body and the status; normalize to a ProviderErrorContext-shaped view.
export function readErrorFromResponse(
  response: ProviderHttpResponse | undefined,
  request: ProviderErrorContext['request'],
  transportError: unknown,
): { message: string | null; code: string | null; bodyJson: unknown } {
  if (!response) {
    // transport error: e.g. ECONNREFUSED, timeout
    const msg = transportError instanceof Error ? transportError.message : String(transportError);
    return { message: msg, code: null, bodyJson: null };
  }
  const bodyJson = safeJsonParse(response.bodyText);
  const { message, code } = extractProviderErrorFields(bodyJson);
  return { message, code, bodyJson };
}
