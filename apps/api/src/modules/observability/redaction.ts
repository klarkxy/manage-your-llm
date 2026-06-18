// Log redaction (post-M7 hardening).
//
// MVP rule: no raw consumer keys, no raw upstream API keys, no Authorization
// / x-api-key header values may land in the application log. The list of
// redacted keys is applied to any structured payload before it is forwarded
// to fastify's logger or to the audit store. We also walk one level deep into
// nested objects so a redacted header field nested under `headers` is still
// caught.

const REDACTED = '[redacted]';

const HEADER_KEYS = new Set(['authorization', 'x-api-key', 'x-auth-token', 'cookie', 'set-cookie']);

const PREFIX_PATTERNS: RegExp[] = [
  /\bmh_[A-Za-z0-9_-]+/g, // consumer keys
  /\bsk-[A-Za-z0-9_-]+/g, // generic upstream API keys
  /\bsk-ant-[A-Za-z0-9_-]+/g, // Anthropic-style
];

export function redactString(input: string): string {
  let out = input;
  for (const re of PREFIX_PATTERNS) {
    out = out.replace(re, REDACTED);
  }
  return out;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (value instanceof Error) {
    // Errors serialize their message + name. We preserve the type so callers
    // can still `.stack`-log it, but replace any plaintext key inside the
    // message so leaked secrets don't escape via the logger.
    const redactedMessage = redactString(value.message);
    if (redactedMessage === value.message) return value;
    const Ctor = value.constructor as new (message: string) => Error;
    const out = new Ctor(redactedMessage);
    out.name = value.name;
    out.stack = value.stack;
    return out;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (HEADER_KEYS.has(k.toLowerCase())) {
        out[k] = REDACTED;
        continue;
      }
      out[k] = redactValue(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

export interface RedactingLoggerDelegate {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

// Wraps a fastify-style logger so every structured payload is redacted
// before it is forwarded. The default logger keeps the same variadic
// signature (ctx object + message); we redact the first object argument
// if present.
export function wrapLogger<T extends RedactingLoggerDelegate>(logger: T): T {
  return {
    info: (...args: unknown[]) => logger.info(...args.map(redactArg)),
    warn: (...args: unknown[]) => logger.warn(...args.map(redactArg)),
    error: (...args: unknown[]) => logger.error(...args.map(redactArg)),
    debug: (...args: unknown[]) => logger.debug(...args.map(redactArg)),
  } as T;
}

function redactArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg;
  if (typeof arg === 'string') return redactString(arg);
  if (typeof arg === 'object') return redactValue(arg);
  return arg;
}
