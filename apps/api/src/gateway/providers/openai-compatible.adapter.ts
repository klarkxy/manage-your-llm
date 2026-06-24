import type { ChatRequestIR, NormalizedChatResponse, OpenAIChatCompletionsResponse, OpenAIResponsesResponse, OpenAIChatMessage, OpenAIResponsesInputItem } from '@manageyourllm/shared';
import {
  ProviderError,
  ProviderQuotaError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  type NormalizedError,
} from '@manageyourllm/shared';
import type { BuildRequestContext, NormalizeResponseContext, NormalizeErrorContext, ProviderHttpRequest, ProviderAdapter } from './adapter.js';

function buildChatCompletionBody(ir: ChatRequestIR): Record<string, unknown> {
  const messages: OpenAIChatMessage[] = [];
  if (ir.system) {
    messages.push({ role: 'system', content: ir.system });
  }
  for (const msg of ir.messages) {
    if (msg.role === 'tool') {
      messages.push({ role: 'tool', content: msg.content, tool_call_id: msg.toolCallId });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  const body: Record<string, unknown> = {
    model: ir.requestedModel,
    messages,
    stream: false,
  };
  if (ir.maxTokens != null) body.max_tokens = ir.maxTokens;
  if (ir.temperature != null) body.temperature = ir.temperature;
  if (ir.topP != null) body.top_p = ir.topP;
  return body;
}

function buildResponsesBody(ir: ChatRequestIR): Record<string, unknown> {
  let input: string | OpenAIResponsesInputItem[];
  if (ir.messages.length === 1 && ir.messages[0]?.role === 'user') {
    input = ir.messages[0].content;
  } else {
    input = ir.messages.map((msg) => {
      if (msg.role === 'tool') {
        return { type: 'message', role: 'tool', content: msg.content, call_id: msg.toolCallId };
      }
      return { type: 'message', role: msg.role, content: msg.content };
    });
  }
  const body: Record<string, unknown> = { model: ir.requestedModel, input, stream: false };
  if (ir.system) body.instructions = ir.system;
  if (ir.maxTokens != null) body.max_output_tokens = ir.maxTokens;
  if (ir.temperature != null) body.temperature = ir.temperature;
  if (ir.topP != null) body.top_p = ir.topP;
  return body;
}

function normalizeChatResponse(body: OpenAIChatCompletionsResponse): NormalizedChatResponse {
  const choice = body.choices?.[0];
  const messageContent = choice?.message?.content ?? '';
  const usage = body.usage;
  return {
    id: body.id ?? 'unknown',
    model: body.model ?? 'unknown',
    content: typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent),
    stopReason: choice?.finish_reason ?? null,
    usage: usage
      ? {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : null,
    rawResponse: body,
  };
}

function normalizeResponsesResponse(body: OpenAIResponsesResponse): NormalizedChatResponse {
  const output = body.output?.[0];
  const text = output?.content?.[0]?.text ?? '';
  const usage = body.usage;
  return {
    id: body.id ?? 'unknown',
    model: body.model ?? 'unknown',
    content: text,
    stopReason: null,
    usage: usage
      ? {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.total_tokens,
        }
      : null,
    rawResponse: body,
  };
}

function normalizeErrorBody(status: number, body: unknown): { message: string; code?: string | null } {
  if (body && typeof body === 'object') {
    const err = (body as Record<string, unknown>)['error'];
    if (err && typeof err === 'object') {
      return {
        message: String((err as Record<string, unknown>)['message'] ?? 'Upstream error'),
        code: (err as Record<string, unknown>)['code'] as string | null | undefined,
      };
    }
  }
  return { message: `Upstream HTTP ${status}` };
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  buildRequest(ctx: BuildRequestContext): ProviderHttpRequest {
    const { upstreamKey, realModelName, ir, authHeaders } = ctx;
    const isResponses = ir.sourceProtocol === 'codex';
    const path = isResponses ? '/v1/responses' : '/v1/chat/completions';
    const baseUrl = upstreamKey.baseUrl.replace(/\/$/, '');
    const body = isResponses ? buildResponsesBody({ ...ir, requestedModel: realModelName }) : buildChatCompletionBody({ ...ir, requestedModel: realModelName });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(upstreamKey.defaultHeadersJson ?? {}),
      ...(upstreamKey.extraHeadersJson ?? {}),
    };

    return {
      url: `${baseUrl}${path}`,
      method: 'POST',
      headers,
      body: { ...body, ...(upstreamKey.extraParamsJson ?? {}) },
    };
  }

  normalizeResponse(ctx: NormalizeResponseContext): NormalizedChatResponse {
    const body = ctx.body as OpenAIChatCompletionsResponse | OpenAIResponsesResponse;
    if (ctx.sourceProtocol === 'codex') {
      return normalizeResponsesResponse(body as OpenAIResponsesResponse);
    }
    return normalizeChatResponse(body as OpenAIChatCompletionsResponse);
  }

  normalizeError(ctx: NormalizeErrorContext): NormalizedError {
    const { status, body } = ctx;
    const { message, code } = normalizeErrorBody(status, body);
    if (status === 429) return new ProviderRateLimitError(message, { code });
    if (status === 408) return new ProviderTimeoutError(message, { code });
    if (code === 'insufficient_quota' || code === 'quota_exceeded') {
      return new ProviderQuotaError(message, { code });
    }
    return new ProviderError(message, { code, status });
  }
}
