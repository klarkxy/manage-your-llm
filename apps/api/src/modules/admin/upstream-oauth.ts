import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, lte } from 'drizzle-orm';
import { generateId, ValidationError } from '@modelharbor/shared';
import type { AuthenticatedRequest } from '../auth/admin.js';
import { oauthSessions, type Db } from '../db/index.js';
import {
  buildCodexAuthorizeUrl,
  DEFAULT_CLIENT_ID as CODEX_DEFAULT_CLIENT_ID,
  DEFAULT_REDIRECT_URI as CODEX_DEFAULT_REDIRECT_URI,
  exchangeCodexCode,
  generatePkce,
} from '../providers/auth/codex-oauth.js';
import { buildCozeAuthorizeUrl, exchangeCozeCode } from '../providers/auth/coze-oauth-pkce.js';
import type { UpstreamAuthType } from '../providers/auth/index.js';
import { discoverUpstreamModels, type DiscoverModelsBody } from './upstream-keys.js';

export interface UpstreamOAuthRouteDeps {
  db: Db;
  secretKey: string;
}

const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

type OAuthProvider = 'codex' | 'coze';

interface OAuthInitBody {
  provider?: unknown;
  authType?: unknown;
  clientId?: unknown;
  redirectUri?: unknown;
  baseUrl?: unknown;
  workspaceId?: unknown;
  upstreamKeyId?: unknown;
  draft?: unknown;
}

interface OAuthExchangeBody {
  state?: unknown;
  code?: unknown;
}

function getAdminId(req: FastifyRequest): string {
  return (req as AuthenticatedRequest).admin.id;
}

function assertProvider(value: unknown): OAuthProvider {
  if (value === 'codex' || value === 'coze') return value;
  throw new ValidationError(`provider must be "codex" or "coze"`);
}

function assertAuthTypeForProvider(provider: OAuthProvider, value: unknown): UpstreamAuthType {
  if (provider === 'codex' && value === 'codex_oauth') return 'codex_oauth';
  if (provider === 'coze' && value === 'coze_oauth_pkce') return 'coze_oauth_pkce';
  throw new ValidationError(`authType must match provider (${provider})`);
}

function normalizeInitBody(body: OAuthInitBody) {
  const provider = assertProvider(body.provider);
  const authType = assertAuthTypeForProvider(provider, body.authType);

  let clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  let redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : '';
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const upstreamKeyId = typeof body.upstreamKeyId === 'string' ? body.upstreamKeyId.trim() : '';

  if (provider === 'codex') {
    if (!clientId) clientId = CODEX_DEFAULT_CLIENT_ID;
    // OpenAI's public Codex OAuth app is registered to a fixed redirect URI.
    // When the default client ID is used we must send that exact URI, even if
    // the frontend supplied a different value.
    if (clientId === CODEX_DEFAULT_CLIENT_ID) {
      redirectUri = CODEX_DEFAULT_REDIRECT_URI;
    } else if (!redirectUri) {
      redirectUri = CODEX_DEFAULT_REDIRECT_URI;
    }
  }

  if (!clientId) throw new ValidationError('clientId is required');
  if (!redirectUri) throw new ValidationError('redirectUri is required');
  if (provider === 'coze' && !baseUrl)
    throw new ValidationError('baseUrl is required for Coze PKCE');

  const draft = body.draft;
  if (!upstreamKeyId && (!draft || typeof draft !== 'object' || Array.isArray(draft))) {
    throw new ValidationError('draft is required when creating a new upstream key');
  }
  if (upstreamKeyId && draft) {
    throw new ValidationError('cannot provide both upstreamKeyId and draft');
  }

  return {
    provider,
    authType,
    clientId,
    redirectUri,
    baseUrl,
    workspaceId,
    upstreamKeyId,
    draft: draft as Record<string, unknown> | undefined,
  };
}

async function loadAndConsumeSession(db: Db, state: string, adminUserId: string) {
  const now = new Date();
  const row = await db.select().from(oauthSessions).where(eq(oauthSessions.id, state)).get();

  if (!row || row.expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  // One-time use: delete immediately so the code cannot be replayed.
  await db.delete(oauthSessions).where(eq(oauthSessions.id, state));

  if (row.adminUserId !== adminUserId) {
    return null;
  }

  return row;
}

async function pruneExpiredSessions(db: Db): Promise<void> {
  await db.delete(oauthSessions).where(lte(oauthSessions.expiresAt, new Date()));
}

export function registerUpstreamOAuthRoutes(
  app: FastifyInstance,
  deps: UpstreamOAuthRouteDeps,
): void {
  const { db, secretKey } = deps;

  app.post('/api/admin/upstream-keys/oauth-init', async (req, _reply) => {
    const adminUserId = getAdminId(req);
    const input = normalizeInitBody((req.body ?? {}) as OAuthInitBody);
    const { verifier, challenge } = generatePkce();
    const state = generateId('oauth');

    let authorizationUrl: string;
    if (input.provider === 'codex') {
      authorizationUrl = buildCodexAuthorizeUrl({
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        state,
        codeChallenge: challenge,
      });
    } else {
      authorizationUrl = buildCozeAuthorizeUrl({
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        state,
        codeChallenge: challenge,
        baseUrl: input.baseUrl,
        workspaceId: input.workspaceId || undefined,
      });
    }

    const now = new Date();
    await db.insert(oauthSessions).values({
      id: state,
      provider: input.provider,
      authType: input.authType,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      baseUrl: input.baseUrl || null,
      workspaceId: input.workspaceId || null,
      codeVerifier: verifier,
      adminUserId,
      upstreamKeyId: input.upstreamKeyId || null,
      draftJson: input.draft ? JSON.stringify(input.draft) : null,
      expiresAt: new Date(now.getTime() + OAUTH_SESSION_TTL_MS),
      createdAt: now,
    });

    // Best-effort cleanup of old sessions so the table does not grow unbounded.
    void pruneExpiredSessions(db).catch(() => undefined);

    return { authorizationUrl, state };
  });

  app.post('/api/admin/upstream-keys/oauth-exchange', async (req, reply) => {
    const adminUserId = getAdminId(req);
    const body = (req.body ?? {}) as OAuthExchangeBody;
    const state = typeof body.state === 'string' ? body.state : '';
    const code = typeof body.code === 'string' ? body.code : '';

    if (!state || !code) {
      reply.code(400).send({
        error: {
          message: 'state and code are required',
          type: 'validation_error',
          code: 'validation_error',
        },
      });
      return;
    }

    const session = await loadAndConsumeSession(db, state, adminUserId);
    if (!session) {
      reply.code(400).send({
        error: {
          message: 'OAuth session expired or invalid',
          type: 'validation_error',
          code: 'oauth_session_invalid',
        },
      });
      return;
    }

    let tokenResp: { access_token: string; refresh_token?: string; expires_in: number };
    try {
      if (session.provider === 'codex') {
        tokenResp = await exchangeCodexCode({
          clientId: session.clientId,
          redirectUri: session.redirectUri,
          code,
          codeVerifier: session.codeVerifier,
          tokenUrl: session.baseUrl || undefined,
        });
      } else {
        if (!session.baseUrl) {
          throw new ValidationError('Coze baseUrl missing from OAuth session');
        }
        tokenResp = await exchangeCozeCode({
          clientId: session.clientId,
          redirectUri: session.redirectUri,
          code,
          codeVerifier: session.codeVerifier,
          baseUrl: session.baseUrl,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'token exchange failed';
      reply.code(502).send({
        error: {
          message,
          type: 'provider_error',
          code: 'oauth_token_exchange_failed',
        },
      });
      return;
    }

    if (!tokenResp.refresh_token) {
      reply.code(502).send({
        error: {
          message: 'OAuth provider did not return a refresh token',
          type: 'provider_error',
          code: 'oauth_no_refresh_token',
        },
      });
      return;
    }

    const authConfig =
      session.provider === 'codex'
        ? buildCodexAuthConfig(session, tokenResp.refresh_token)
        : buildCozeAuthConfig(session, tokenResp.refresh_token);

    const cookie = req.headers.cookie ?? '';
    let res: Awaited<ReturnType<typeof app.inject>>;

    // For browser-based OAuth flows the admin may not know the available
    // models until a refresh token is obtained. Auto-discover the models
    // when the draft does not contain any usable mappings.
    if (!session.upstreamKeyId) {
      const draft = session.draftJson
        ? (JSON.parse(session.draftJson) as Record<string, unknown>)
        : {};
      const draftMappings = draft.modelMappings;
      const hasUsableMappings =
        Array.isArray(draftMappings) &&
        draftMappings.some(
          (m) =>
            m &&
            typeof m === 'object' &&
            typeof (m as { realName?: unknown }).realName === 'string' &&
            (m as { realName: string }).realName.trim() !== '',
        );
      if (!hasUsableMappings) {
        const discoverBody: DiscoverModelsBody = {
          baseUrl: draft.baseUrl ?? session.baseUrl,
          providerType: draft.providerType,
          providerPresetId: draft.providerPresetId,
          authType: session.authType,
          authConfig,
        };
        if (session.provider === 'coze') {
          discoverBody.workspaceId = session.workspaceId;
        }
        const discovered = await discoverUpstreamModels({
          body: discoverBody,
          db,
          secretKey,
        });
        draft.modelMappings = discovered.map((m) => ({
          realName: m.realName,
          publicName: m.publicName,
          enabled: true,
        }));
        session.draftJson = JSON.stringify(draft);
      }
    }

    if (session.upstreamKeyId) {
      res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/upstream-keys/${session.upstreamKeyId}`,
        headers: { cookie },
        payload: {
          authType: session.authType,
          authConfig,
        },
      });
    } else {
      const draft = session.draftJson
        ? (JSON.parse(session.draftJson) as Record<string, unknown>)
        : {};
      res = await app.inject({
        method: 'POST',
        url: '/api/admin/upstream-keys',
        headers: { cookie },
        payload: {
          ...draft,
          authType: session.authType,
          authConfig,
        },
      });
    }

    const payload = res.payload ? (JSON.parse(res.payload) as unknown) : undefined;
    if (res.statusCode >= 400) {
      reply.code(res.statusCode).send(payload);
      return;
    }

    return payload;
  });
}

function buildCodexAuthConfig(
  session: { clientId: string; baseUrl: string | null; authType: string },
  refreshToken: string,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    refreshToken,
    clientId: session.clientId,
  };
  if (session.baseUrl && session.baseUrl !== CODEX_DEFAULT_CLIENT_ID) {
    config.tokenUrl = session.baseUrl;
  }
  return config;
}

function buildCozeAuthConfig(
  session: { clientId: string; redirectUri: string },
  refreshToken: string,
): Record<string, unknown> {
  return {
    refreshToken,
    clientId: session.clientId,
    redirectUri: session.redirectUri,
  };
}
