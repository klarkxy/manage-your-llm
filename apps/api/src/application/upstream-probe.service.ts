import { UpstreamSender } from '../gateway/upstream-sender.js';
import { UpstreamAuthResolver } from '../gateway/upstream-auth-resolver.js';
import { UpstreamKeyRepository } from '../infrastructure/db/repositories/upstream-key.repository.js';
import { protocolFor } from '@manageyourllm/shared';
import type { Db } from '../infrastructure/db/client.js';
import type { UpstreamKeyRow } from '../infrastructure/db/schema.js';

export interface UpstreamProbeServiceDeps {
  db: Db;
  secretKey: string;
  sender?: UpstreamSender;
}

export interface DiscoveredModel {
  id: string;
  object: string;
  ownedBy?: string;
}

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  error: string | null;
}

function chatCompletionPathFor(providerType: UpstreamKeyRow['providerType']): string {
  const protocol = protocolFor(providerType);
  return protocol === 'anthropic' ? '/v1/messages' : '/v1/chat/completions';
}

function defaultModelFor(providerType: UpstreamKeyRow['providerType']): string {
  switch (providerType) {
    case 'anthropic_compatible':
    case 'deepseek':
    case 'moonshot':
    case 'minimax':
      return 'claude-3-haiku-20240307';
    case 'codex':
      return 'codex-mini';
    default:
      return 'gpt-3.5-turbo';
  }
}

export class UpstreamProbeService {
  private readonly repo: UpstreamKeyRepository;
  private readonly authResolver: UpstreamAuthResolver;
  private readonly sender: UpstreamSender;

  constructor(private readonly deps: UpstreamProbeServiceDeps) {
    this.repo = new UpstreamKeyRepository(deps.db);
    this.authResolver = new UpstreamAuthResolver({ secretKey: deps.secretKey });
    this.sender = deps.sender ?? new UpstreamSender();
  }

  async discoverModels(upstreamKeyId: string): Promise<DiscoveredModel[]> {
    const upstream = await this.repo.findById(upstreamKeyId);
    if (!upstream) {
      throw new Error('上游密钥不存在');
    }

    const authHeaders = await this.authResolver.resolveAuthHeaders(upstream);
    const url = `${upstream.baseUrl.replace(/\/$/, '')}/v1/models`;

    const res = await this.sender.send({
      url,
      method: 'GET',
      headers: { ...authHeaders, ...(upstream.defaultHeadersJson ?? {}) },
      body: null,
      timeoutMs: 30_000,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`上游返回 ${res.status}`);
    }

    const body = res.body as Record<string, unknown> | null;
    const data = body?.data;
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => ({
        id: String(m.id ?? ''),
        object: String(m.object ?? 'model'),
        ownedBy: m.owned_by ? String(m.owned_by) : undefined,
      }))
      .filter((m) => m.id.length > 0);
  }

  async ping(upstreamKeyId: string, modelName?: string): Promise<PingResult> {
    const upstream = await this.repo.findById(upstreamKeyId);
    if (!upstream) {
      return { ok: false, latencyMs: 0, error: '上游密钥不存在' };
    }

    const model =
      modelName ??
      (upstream.supportedModelsJson.length > 0
        ? upstream.supportedModelsJson[0]
        : defaultModelFor(upstream.providerType));
    if (!model) {
      return { ok: false, latencyMs: 0, error: '未指定模型且上游没有默认模型' };
    }

    const authHeaders = await this.authResolver.resolveAuthHeaders(upstream);
    const url = `${upstream.baseUrl.replace(/\/$/, '')}${chatCompletionPathFor(upstream.providerType)}`;
    const protocol = protocolFor(upstream.providerType);

    const body: Record<string, unknown> =
      protocol === 'anthropic'
        ? {
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }
        : {
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          };

    const startedAt = performance.now();
    try {
      const res = await this.sender.send({
        url,
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          ...(upstream.defaultHeadersJson ?? {}),
        },
        body,
        timeoutMs: 30_000,
      });
      const latencyMs = Math.round(performance.now() - startedAt);

      if (res.status >= 200 && res.status < 300) {
        return { ok: true, latencyMs, error: null };
      }
      const errorBody = res.body as { error?: { message?: string } } | undefined;
      const message = errorBody?.error?.message ?? `上游返回 ${res.status}`;
      return { ok: false, latencyMs, error: message };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt);
      return { ok: false, latencyMs, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
