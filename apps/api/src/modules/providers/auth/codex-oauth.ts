import { ValidationError } from '@modelharbor/shared';
import { eq } from 'drizzle-orm';
import { parseJsonRecord } from '../../admin/helpers.js';
import { decryptSecret, encryptSecret } from '../../auth/crypto.js';
import { upstreamKeys } from '../../db/index.js';
import type { AuthHeaderResult, UpstreamAuthContext, UpstreamAuthStrategy } from './index.js';

export interface CodexOauthConfig {
  refreshToken: string;
  clientId: string;
  tokenUrl: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

interface TokenCacheEntry {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Default values mirror the OpenAI Codex CLI public OAuth app. Users can
// override them in the auth config if they are using a custom OAuth app.
const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEFAULT_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const EXPIRY_BUFFER_MS = 60_000;

const tokenCache = new Map<string, TokenCacheEntry>();
const refreshPromises = new Map<string, Promise<TokenResponse>>();

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${name} is required`);
  }
  return value;
}

function normalizeConfig(config: Record<string, unknown>): CodexOauthConfig {
  return {
    refreshToken: assertString(config.refreshToken, 'refreshToken'),
    clientId:
      typeof config.clientId === 'string' && config.clientId.length > 0
        ? config.clientId
        : DEFAULT_CLIENT_ID,
    tokenUrl:
      typeof config.tokenUrl === 'string' && config.tokenUrl.length > 0
        ? config.tokenUrl
        : DEFAULT_TOKEN_URL,
  };
}

async function exchangeRefreshToken(config: CodexOauthConfig): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    client_id: config.clientId,
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: params.toString(),
  });

  const bodyText = await res.text();
  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    bodyJson = null;
  }

  if (!res.ok) {
    const message =
      bodyJson &&
      typeof bodyJson === 'object' &&
      typeof (bodyJson as { error?: unknown }).error === 'string'
        ? (bodyJson as { error: string }).error
        : bodyText || `HTTP ${res.status}`;
    throw new Error(`Codex OAuth token refresh failed: ${message}`);
  }

  if (!bodyJson || typeof bodyJson !== 'object') {
    throw new Error('Codex OAuth token endpoint returned invalid JSON');
  }

  const typed = bodyJson as Partial<TokenResponse>;
  if (typeof typed.access_token !== 'string' || typeof typed.expires_in !== 'number') {
    throw new Error('Codex OAuth token response missing access_token or expires_in');
  }

  return {
    access_token: typed.access_token,
    refresh_token: typed.refresh_token,
    expires_in: typed.expires_in,
    token_type: typed.token_type,
    scope: typed.scope,
  };
}

async function refreshForKey(
  ctx: UpstreamAuthContext,
  config: CodexOauthConfig,
): Promise<TokenResponse> {
  const key = ctx.row.id;
  const inFlight = refreshPromises.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async (): Promise<TokenResponse> => {
    const tokenResp = await exchangeRefreshToken(config);
    const newRefreshToken = tokenResp.refresh_token ?? config.refreshToken;
    tokenCache.set(key, {
      accessToken: tokenResp.access_token,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + tokenResp.expires_in * 1000,
    });
    await persistRotatedRefreshToken(ctx, config, newRefreshToken);
    return tokenResp;
  })();

  refreshPromises.set(key, promise);
  try {
    return await promise;
  } finally {
    refreshPromises.delete(key);
  }
}

async function persistRotatedRefreshToken(
  ctx: UpstreamAuthContext,
  config: CodexOauthConfig,
  newRefreshToken: string,
): Promise<void> {
  if (!ctx.db || newRefreshToken === config.refreshToken) {
    return;
  }

  try {
    const existingCiphertext = ctx.row.authConfigCiphertext;
    if (!existingCiphertext) {
      return;
    }
    const plaintext = decryptSecret(existingCiphertext, ctx.secretKey);
    const existing = parseJsonRecord(plaintext) ?? {};
    existing['refreshToken'] = newRefreshToken;
    const updatedCiphertext = encryptSecret(JSON.stringify(existing), ctx.secretKey).ciphertext;
    await ctx.db
      .update(upstreamKeys)
      .set({ authConfigCiphertext: updatedCiphertext, updatedAt: new Date() })
      .where(eq(upstreamKeys.id, ctx.row.id));
  } catch (err) {
    // Persisting the rotated refresh token is best-effort. If it fails the
    // in-memory cache still has the new token, and the current request succeeds.
    console.error('[codex_oauth] failed to persist rotated refresh token:', err);
  }
}

export const codexOauthStrategy: UpstreamAuthStrategy = {
  type: 'codex_oauth',
  validateConfig(config) {
    const normalized = normalizeConfig(
      config && typeof config === 'object' && !Array.isArray(config)
        ? (config as Record<string, unknown>)
        : {},
    );
    return normalized as unknown as Record<string, unknown>;
  },

  async getHeader(ctx): Promise<AuthHeaderResult> {
    const raw = decryptAuthConfig(ctx.row.authConfigCiphertext, ctx.secretKey);
    const config = normalizeConfig(raw);

    const cached = tokenCache.get(ctx.row.id);
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

// Inline helper so this module can decrypt the auth config without creating a
// circular import back to ./index.ts.
function decryptAuthConfig(
  ciphertext: string | null | undefined,
  secretKey: string,
): Record<string, unknown> {
  if (!ciphertext) {
    return {};
  }
  try {
    const plaintext = decryptSecret(ciphertext, secretKey);
    return parseJsonRecord(plaintext) ?? {};
  } catch {
    return {};
  }
}

// Exposed for tests so they can reset internal state between cases.
export function _resetCodexOauthCache(): void {
  tokenCache.clear();
  refreshPromises.clear();
}
