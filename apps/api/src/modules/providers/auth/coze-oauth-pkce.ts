import { generatePkce } from './oauth-pkce.js';
import { eq } from 'drizzle-orm';
import { ValidationError } from '@modelharbor/shared';
import { decryptSecret, encryptSecret } from '../../auth/crypto.js';
import { parseJsonRecord } from '../../admin/helpers.js';
import { upstreamKeys } from '../../db/index.js';
import type { AuthHeaderResult, UpstreamAuthContext, UpstreamAuthStrategy } from './index.js';

export interface CozeOauthPkceConfig {
  refreshToken: string;
  clientId: string;
  redirectUri: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface TokenCacheEntry {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_CACHE = new Map<string, TokenCacheEntry>();
const REFRESH_PROMISES = new Map<string, Promise<OAuthTokenResponse>>();
const EXPIRY_BUFFER_MS = 60_000;

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${name} is required`);
  }
  return value;
}

function normalizeConfig(config: Record<string, unknown>): CozeOauthPkceConfig {
  return {
    refreshToken: assertString(config.refreshToken, 'refreshToken'),
    clientId: assertString(config.clientId, 'clientId'),
    redirectUri: assertString(config.redirectUri, 'redirectUri'),
  };
}

function tokenUrlForBase(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/permission/oauth2/token`;
}

export function authorizeBaseForCoze(baseUrl: string): string {
  // Coze authorization pages live on the www origin, while token/endpoints are
  // on the api origin.
  return baseUrl.replace(/^https:\/\/api\./, 'https://www.');
}

export function buildCozeAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  baseUrl: string;
  workspaceId?: string;
}): string {
  const authBase = authorizeBaseForCoze(params.baseUrl);
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });
  const path = params.workspaceId
    ? `/api/permission/oauth2/workspace_id/${params.workspaceId}/authorize`
    : '/api/permission/oauth2/authorize';
  return `${authBase}${path}?${query.toString()}`;
}

export async function exchangeCozeCode(params: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  baseUrl: string;
}): Promise<OAuthTokenResponse> {
  const res = await fetch(tokenUrlForBase(params.baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code: params.code,
      code_verifier: params.codeVerifier,
    }),
  });
  return parseTokenResponse(res, 'Coze PKCE code exchange');
}

async function refreshCozeToken(
  config: CozeOauthPkceConfig,
  baseUrl: string,
): Promise<OAuthTokenResponse> {
  const res = await fetch(tokenUrlForBase(baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: config.refreshToken,
    }),
  });
  return parseTokenResponse(res, 'Coze PKCE token refresh');
}

async function parseTokenResponse(res: Response, context: string): Promise<OAuthTokenResponse> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message =
      json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
        ? (json as { error: string }).error
        : text || `HTTP ${res.status}`;
    throw new Error(`${context} failed: ${message}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error(`${context} returned invalid JSON`);
  }

  const typed = json as Partial<OAuthTokenResponse>;
  if (typeof typed.access_token !== 'string' || typeof typed.expires_in !== 'number') {
    throw new Error(`${context} response missing access_token or expires_in`);
  }

  return {
    access_token: typed.access_token,
    refresh_token: typed.refresh_token,
    expires_in: typed.expires_in,
  };
}

async function refreshForKey(
  ctx: UpstreamAuthContext,
  config: CozeOauthPkceConfig,
): Promise<OAuthTokenResponse> {
  const key = ctx.row.id;
  const inFlight = REFRESH_PROMISES.get(key);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<OAuthTokenResponse> => {
    const tokenResp = await refreshCozeToken(config, ctx.baseUrl);
    const newRefreshToken = tokenResp.refresh_token ?? config.refreshToken;
    TOKEN_CACHE.set(key, {
      accessToken: tokenResp.access_token,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + tokenResp.expires_in * 1000,
    });
    await persistRotatedRefreshToken(ctx, config, newRefreshToken);
    return tokenResp;
  })();

  REFRESH_PROMISES.set(key, promise);
  try {
    return await promise;
  } finally {
    REFRESH_PROMISES.delete(key);
  }
}

async function persistRotatedRefreshToken(
  ctx: UpstreamAuthContext,
  config: CozeOauthPkceConfig,
  newRefreshToken: string,
): Promise<void> {
  if (!ctx.db || newRefreshToken === config.refreshToken) return;

  try {
    const existingCiphertext = ctx.row.authConfigCiphertext;
    if (!existingCiphertext) return;
    const plaintext = decryptSecret(existingCiphertext, ctx.secretKey);
    const existing = parseJsonRecord(plaintext) ?? {};
    existing['refreshToken'] = newRefreshToken;
    const updatedCiphertext = encryptSecret(JSON.stringify(existing), ctx.secretKey).ciphertext;
    await ctx.db
      .update(upstreamKeys)
      .set({ authConfigCiphertext: updatedCiphertext, updatedAt: new Date() })
      .where(eq(upstreamKeys.id, ctx.row.id));
  } catch (err) {
    void err;
  }
}

export const cozeOauthPkceStrategy: UpstreamAuthStrategy = {
  type: 'coze_oauth_pkce',

  validateConfig(config: unknown): Record<string, unknown> {
    const normalized = normalizeConfig(
      config && typeof config === 'object' && !Array.isArray(config)
        ? (config as Record<string, unknown>)
        : {},
    );
    return normalized as unknown as Record<string, unknown>;
  },

  async getHeader(ctx: UpstreamAuthContext): Promise<AuthHeaderResult> {
    const raw = decryptAuthConfig(ctx.row.authConfigCiphertext, ctx.secretKey);
    const config = normalizeConfig(raw);

    const cached = TOKEN_CACHE.get(ctx.row.id);
    if (cached && cached.expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
      return { header: `Bearer ${cached.accessToken}`, expiresAt: new Date(cached.expiresAt) };
    }

    const tokenResp = await refreshForKey(ctx, config);
    return {
      header: `Bearer ${tokenResp.access_token}`,
      expiresAt: new Date(Date.now() + tokenResp.expires_in * 1000),
    };
  },
};

function decryptAuthConfig(
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

export { generatePkce };

// Exposed for tests so they can reset internal state between cases.
export function _resetCozeOauthPkceCache(): void {
  TOKEN_CACHE.clear();
  REFRESH_PROMISES.clear();
}
