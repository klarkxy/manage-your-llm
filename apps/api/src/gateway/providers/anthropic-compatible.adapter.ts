import type {
  ChatRequestIR,
  NormalizedChatResponse,
  AnthropicMessagesResponse,
  AnthropicMessagesRequest,
  SourceProtocol,
} from '@manageyourllm/shared';
import {
  ProviderError,
  ProviderQuotaError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  type NormalizedError,
} from '@manageyourllm/shared';
import type {
  BuildRequestContext,
  NormalizeResponseContext,
  NormalizeErrorContext,
  ProviderHttpRequest,
  ProviderAdapter,
} from './adapter.js';

function buildMessagesBody(ir: ChatRequestIR, realModelName: string): AnthropicMessagesRequest {
  const messages = ir.messages.map((msg) => ({
    role:
      msg.role === 'tool'
        ? ('user' as const)
        : msg.role === 'system'
          ? ('user' as const)
          : msg.role,
    content: msg.content,
  }));
  const body: AnthropicMessagesRequest = {
    model: realModelName,
    messages,
    stream: ir.stream,
  };
  if (ir.system) body.system = ir.system;
  if (ir.maxTokens != null) body.max_tokens = ir.maxTokens;
  if (ir.temperature != null) body.temperature = ir.temperature;
  if (ir.topP != null) body.top_p = ir.topP;
  if (ir.metadata.user_id) body.metadata = { user_id: ir.metadata.user_id };
  return body;
}

function normalizeResponse(body: AnthropicMessagesResponse): NormalizedChatResponse {
  const content = body.content ?? [];
  const text = content
    .map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .join('');
  const usage = body.usage;
  return {
    id: body.id ?? 'unknown',
    model: body.model ?? 'unknown',
    content: text,
    stopReason: body.stop_reason ?? null,
    usage: usage
      ? {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.input_tokens + usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens,
          cacheWriteTokens: usage.cache_creation_input_tokens,
        }
      : null,
    rawResponse: body,
  };
}

function normalizeErrorBody(status: number, body: unknown): { message: string; code?: string } {
  if (body && typeof body === 'object') {
    const err = (body as Record<string, unknown>)['error'];
    if (err && typeof err === 'object') {
      return {
        message: String((err as Record<string, unknown>)['message'] ?? 'Upstream error'),
        code: String((err as Record<string, unknown>)['type'] ?? ''),
      };
    }
  }
  return { message: `Upstream HTTP ${status}` };
}

export class AnthropicCompatibleAdapter implements ProviderAdapter {
  buildRequest(ctx: BuildRequestContext): ProviderHttpRequest {
    const { upstreamKey, realModelName, ir, authHeaders } = ctx;
    const baseUrl = upstreamKey.baseUrl.replace(/\/$/, '');
    const body = buildMessagesBody(ir, realModelName);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...authHeaders,
      ...(upstreamKey.defaultHeadersJson ?? {}),
      ...(upstreamKey.extraHeadersJson ?? {}),
    };
    return {
      url: `${baseUrl}/v1/messages`,
      method: 'POST',
      headers,
      body: { ...body, ...(upstreamKey.extraParamsJson ?? {}) },
    };
  }

  normalizeResponse(ctx: NormalizeResponseContext): NormalizedChatResponse {
    return normalizeResponse(ctx.body as AnthropicMessagesResponse);
  }

  normalizeError(ctx: NormalizeErrorContext): NormalizedError {
    const { status, body } = ctx;
    const { message, code } = normalizeErrorBody(status, body);
    if (status === 429) return new ProviderRateLimitError(message, { code });
    if (status === 408) return new ProviderTimeoutError(message, { code });
    if (code?.includes('quota') || code?.includes('rate_limit')) {
      return new ProviderQuotaError(message, { code });
    }
    return new ProviderError(message, { code, status });
  }

  supportsStreaming(sourceProtocol: SourceProtocol): boolean {
    return sourceProtocol === 'anthropic';
  }
}
