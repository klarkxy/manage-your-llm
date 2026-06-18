import { createSign, randomUUID } from 'node:crypto';
import { ValidationError } from '@modelharbor/shared';
import {
  decryptAuthConfig,
  type UpstreamAuthStrategy,
  type AuthHeaderResult,
  type UpstreamAuthContext,
} from './index.js';

interface CozeOauthJwtConfig {
  appId: string;
  kid: string;
  privateKey: string;
  durationSeconds?: number;
}

const DEFAULT_DURATION_SECONDS = 900;
const MAX_DURATION_SECONDS = 86_399;
const TOKEN_CACHE = new Map<string, { accessToken: string; expiresAt: number }>();

function parseBaseUrlHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    throw new ValidationError('invalid baseUrl for Coze OAuth JWT');
  }
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, privateKey: string, kid: string): string {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}

function validateConfig(config: unknown): CozeOauthJwtConfig {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Coze OAuth JWT config is required');
  }
  const c = config as Record<string, unknown>;
  const appId = typeof c.appId === 'string' ? c.appId.trim() : '';
  const kid = typeof c.kid === 'string' ? c.kid.trim() : '';
  const privateKey = typeof c.privateKey === 'string' ? c.privateKey.trim() : '';
  if (!appId) throw new ValidationError('appId is required for Coze OAuth JWT');
  if (!kid) throw new ValidationError('kid is required for Coze OAuth JWT');
  if (!privateKey) throw new ValidationError('privateKey is required for Coze OAuth JWT');

  let durationSeconds = DEFAULT_DURATION_SECONDS;
  if (c.durationSeconds !== undefined && c.durationSeconds !== null) {
    if (typeof c.durationSeconds !== 'number' || !Number.isInteger(c.durationSeconds)) {
      throw new ValidationError('durationSeconds must be an integer');
    }
    durationSeconds = Math.min(Math.max(c.durationSeconds, 1), MAX_DURATION_SECONDS);
  }

  return { appId, kid, privateKey, durationSeconds };
}

async function fetchAccessToken(
  baseUrl: string,
  jwt: string,
  durationSeconds: number,
): Promise<{ accessToken: string; expiresAt: number }> {
  const tokenUrl = `${baseUrl.replace(/\/+$/, '')}/api/permission/oauth2/token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      duration_seconds: durationSeconds,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `Coze OAuth token exchange failed: ${res.status}${bodyText ? ` - ${bodyText.slice(0, 200)}` : ''}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error('Coze OAuth token exchange returned invalid JSON');
  }
  const obj = json as { access_token?: unknown; expires_in?: unknown };
  if (typeof obj.access_token !== 'string' || !obj.access_token) {
    throw new Error('Coze OAuth token exchange did not return access_token');
  }

  let expiresAt: number;
  if (typeof obj.expires_in === 'number' && obj.expires_in > 1_000_000_000) {
    // Coze docs describe expires_in as a Unix timestamp (seconds).
    expiresAt = obj.expires_in * 1000;
  } else if (typeof obj.expires_in === 'number') {
    // Treat as relative seconds as a fallback.
    expiresAt = Date.now() + obj.expires_in * 1000;
  } else {
    expiresAt = Date.now() + durationSeconds * 1000;
  }

  return { accessToken: obj.access_token, expiresAt };
}

export const cozeOauthJwtStrategy: UpstreamAuthStrategy = {
  type: 'coze_oauth_jwt',

  validateConfig(config: unknown): Record<string, unknown> {
    const validated = validateConfig(config);
    return {
      appId: validated.appId,
      kid: validated.kid,
      privateKey: validated.privateKey,
      durationSeconds: validated.durationSeconds,
    };
  },

  async getHeader(ctx: UpstreamAuthContext): Promise<AuthHeaderResult> {
    const rawConfig = decryptAuthConfig(ctx.row.authConfigCiphertext, ctx.secretKey);
    const config = validateConfig(rawConfig);
    const cacheKey = ctx.row.id;
    const now = Date.now();
    const cached = TOKEN_CACHE.get(cacheKey);

    if (cached && cached.expiresAt > now + 60_000) {
      return { header: `Bearer ${cached.accessToken}`, expiresAt: new Date(cached.expiresAt) };
    }

    const host = parseBaseUrlHost(ctx.baseUrl);
    const iat = Math.floor(now / 1000);
    const jwt = signJwt(
      {
        iss: config.appId,
        aud: host,
        iat,
        exp: iat + 600,
        jti: randomUUID(),
      },
      config.privateKey,
      config.kid,
    );

    const token = await fetchAccessToken(
      ctx.baseUrl,
      jwt,
      config.durationSeconds ?? DEFAULT_DURATION_SECONDS,
    );
    TOKEN_CACHE.set(cacheKey, token);

    return { header: `Bearer ${token.accessToken}`, expiresAt: new Date(token.expiresAt) };
  },
};
