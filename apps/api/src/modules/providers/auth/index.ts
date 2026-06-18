import { ValidationError } from '@modelharbor/shared';
import { decryptSecret, encryptSecret } from '../../auth/crypto.js';
import { parseJsonRecord } from '../../admin/helpers.js';
import { patAuthStrategy } from './pat.js';
import { cozeOauthJwtStrategy } from './coze-oauth-jwt.js';
import { cozeOauthPkceStrategy } from './coze-oauth-pkce.js';
import { codexOauthStrategy } from './codex-oauth.js';
import type { Db } from '../../db/index.js';

export type UpstreamAuthType = 'pat' | 'coze_oauth_jwt' | 'coze_oauth_pkce' | 'codex_oauth';

export interface UpstreamAuthKey {
  id: string;
  authType: string | null;
  apiKeyCiphertext: string;
  authConfigCiphertext: string | null;
}

export interface AuthHeaderResult {
  header: string;
  expiresAt?: Date;
}

export interface UpstreamAuthContext {
  row: UpstreamAuthKey;
  secretKey: string;
  baseUrl: string;
  // Optional DB handle so strategies that rotate secrets (e.g. Codex OAuth)
  // can persist the new credential back to the upstream_keys row.
  db?: Db;
}

export interface UpstreamAuthStrategy {
  readonly type: UpstreamAuthType;
  validateConfig(config: unknown): Record<string, unknown>;
  getHeader(ctx: UpstreamAuthContext): Promise<AuthHeaderResult>;
}

const STRATEGIES: Record<UpstreamAuthType, UpstreamAuthStrategy> = {
  pat: patAuthStrategy,
  coze_oauth_jwt: cozeOauthJwtStrategy,
  coze_oauth_pkce: cozeOauthPkceStrategy,
  codex_oauth: codexOauthStrategy,
};

export function listAuthTypes(): UpstreamAuthType[] {
  return Object.keys(STRATEGIES) as UpstreamAuthType[];
}

export function getAuthStrategy(type: string): UpstreamAuthStrategy | undefined {
  return STRATEGIES[type as UpstreamAuthType];
}

export function assertAuthType(value: unknown): UpstreamAuthType {
  if (typeof value !== 'string' || !Object.hasOwn(STRATEGIES, value)) {
    throw new ValidationError(`authType must be one of ${listAuthTypes().join(', ')}`);
  }
  return value as UpstreamAuthType;
}

export function normalizeAuthType(value: unknown): UpstreamAuthType {
  if (typeof value === 'string' && Object.hasOwn(STRATEGIES, value)) {
    return value as UpstreamAuthType;
  }
  return 'pat';
}

export function validateAuthConfig(
  type: UpstreamAuthType,
  config: unknown,
): Record<string, unknown> {
  return STRATEGIES[type].validateConfig(config);
}

export function decryptAuthConfig(
  ciphertext: string | null | undefined,
  secretKey: string,
): Record<string, unknown> {
  if (!ciphertext) return {};
  try {
    const plaintext = decryptSecret(ciphertext, secretKey);
    return parseJsonRecord(plaintext) ?? {};
  } catch {
    return {};
  }
}

export async function resolveAuthorizationHeader(ctx: UpstreamAuthContext): Promise<string> {
  const type = normalizeAuthType(ctx.row.authType);
  const strategy = STRATEGIES[type];
  const result = await strategy.getHeader(ctx);
  return result.header;
}

export interface PlainAuthCredentials {
  authType: UpstreamAuthType;
  apiKey?: string;
  authConfig?: Record<string, unknown>;
}

export async function resolveAuthorizationHeaderFromCredentials(
  baseUrl: string,
  secretKey: string,
  credentials: PlainAuthCredentials,
): Promise<string> {
  const type = normalizeAuthType(credentials.authType);
  if (type === 'pat') {
    if (!credentials.apiKey) {
      throw new ValidationError('apiKey is required for PAT authentication');
    }
    return `Bearer ${credentials.apiKey}`;
  }

  // For provider-specific strategies, encrypt the plaintext config with the
  // gateway secret so we can reuse the normal strategy flow (decrypt + validate).
  const strategy = STRATEGIES[type];
  const validatedConfig = strategy.validateConfig(credentials.authConfig ?? {});
  const ciphertext = encryptSecret(JSON.stringify(validatedConfig), secretKey).ciphertext;
  const result = await strategy.getHeader({
    row: {
      id: `tmp_${Date.now()}`,
      authType: type,
      apiKeyCiphertext: '',
      authConfigCiphertext: ciphertext,
    },
    secretKey,
    baseUrl,
  });
  return result.header;
}
