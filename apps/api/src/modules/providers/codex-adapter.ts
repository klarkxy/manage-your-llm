import {
  type NormalizedChatResponse,
  type OpenAIResponsesInputItem,
  type OpenAIResponsesRequest,
  type OpenAIResponsesResponse,
  type ProviderCapabilities,
  type ProviderType,
} from '@modelharbor/shared';
import type {
  NormalizedProviderError,
  ProviderAdapter,
  ProviderErrorContext,
  ProviderHttpRequest,
  ProviderRequestContext,
  ProviderResponseContext,
  ProviderStreamEventContext,
  ProviderStreamEventResult,
} from './types.js';
import { classifyHttpError, emptyProviderError, readErrorFromResponse } from './errors.js';

const CODEX_RESPONSES_PATH = '/v1/responses';

function irMessagesToInput(
  messages: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCallId?: string;
  }[],
): OpenAIResponsesInputItem[] {
  const input: OpenAIResponsesInputItem[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: m.toolCallId ?? '',
        output: m.content,
      });
      continue;
    }
    input.push({ type: 'message', role: m.role, content: m.content });
  }
  return input;
}

function extractResponseText(body: OpenAIResponsesResponse): string {
  for (const item of body.output ?? []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (
          part &&
          typeof part === 'object' &&
          (part as { type?: string }).type === 'output_text'
        ) {
          const text = (part as { text?: string }).text;
          if (typeof text === 'string') return text;
        }
      }
    }
  }
  return '';
}

function normalizeStopReason(body: OpenAIResponsesResponse): string | null {
  const details = body.incomplete_details;
  if (details && typeof details === 'object' && typeof details.reason === 'string') {
    return details.reason;
  }
  if (body.status === 'completed') {
    return 'stop';
  }
  return body.status ?? null;
}

function buildRequestBody(context: ProviderRequestContext): OpenAIResponsesRequest {
  const input = irMessagesToInput(context.ir.messages);
  const body: OpenAIResponsesRequest = {
    ...(context.extraParams ?? {}),
    model: context.realModelName,
    input,
  };
  if (context.ir.system) {
    body.instructions = context.ir.system;
  }
  if (context.ir.maxTokens !== null) body.max_output_tokens = context.ir.maxTokens;
  if (context.ir.temperature !== null) body.temperature = context.ir.temperature;
  if (context.ir.topP !== null) body.top_p = context.ir.topP;
  if (context.ir.stream) body.stream = true;
  if (context.ir.metadata && typeof context.ir.metadata['user_id'] === 'string') {
    body.metadata = { user_id: context.ir.metadata['user_id'] as string };
  }
  return body;
}

export function createCodexAdapter(): ProviderAdapter {
  return {
    type: 'codex' as ProviderType,

    capabilities: {
      protocols: ['codex'],
      supportsStreaming: true,
      supportsSystemPrompt: true,
      supportsTools: false,
      supportsToolChoice: false,
      supportsVision: false,
      supportsJsonMode: false,
      supportsThinking: false,
      usageAvailability: 'on_demand',
    } satisfies ProviderCapabilities,

    buildRequest(context: ProviderRequestContext): ProviderHttpRequest {
      const body = buildRequestBody(context);
      const base = context.baseUrl.replace(/\/+$/, '');
      const path = context.apiPath ?? CODEX_RESPONSES_PATH;
      return {
        method: 'POST',
        url: `${base}${path}`,
        headers: {
          ...(context.extraHeaders ?? {}),
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${context.apiKey}`,
        },
        body: JSON.stringify(body),
      };
    },

    normalizeResponse(context: ProviderResponseContext): NormalizedChatResponse {
      const json = context.response.bodyJson as OpenAIResponsesResponse | null;
      if (!json || typeof json !== 'object') {
        throw new Error('codex: empty or non-JSON response');
      }
      const text = extractResponseText(json);
      const usage = json.usage
        ? {
            inputTokens: json.usage.input_tokens ?? 0,
            outputTokens: json.usage.output_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          }
        : null;
      return {
        id: json.id,
        model: json.model,
        content: text,
        stopReason: normalizeStopReason(json),
        usage,
        rawResponse: json,
      };
    },

    normalizeStreamEvent(context: ProviderStreamEventContext): ProviderStreamEventResult {
      // Responses API streams are already in the right wire format for Codex
      // clients. Pass every event through unchanged and harvest usage from the
      // final response.completed event.
      const data = context.data;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === 'object') {
        const eventType = (parsed as { type?: string }).type;
        if (eventType === 'response.completed') {
          const usage = (
            parsed as {
              response?: {
                usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
              };
            }
          ).response?.usage;
          if (
            usage &&
            (typeof usage.input_tokens === 'number' || typeof usage.output_tokens === 'number')
          ) {
            const inputTokens = usage.input_tokens ?? 0;
            const outputTokens = usage.output_tokens ?? 0;
            return {
              kind: 'usage',
              inputTokens,
              outputTokens,
              totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
              clientFrame: { event: context.event ?? undefined, data },
            };
          }
          return {
            kind: 'stop',
            reason: 'completed',
            clientFrame: { event: context.event ?? undefined, data },
          };
        }
      }

      return { kind: 'ignored', clientFrame: { event: context.event ?? undefined, data } };
    },

    normalizeError(context: ProviderErrorContext): NormalizedProviderError {
      const { message, code, bodyJson } = readErrorFromResponse(
        context.response,
        context.request,
        context.transportError,
      );
      if (!context.response) {
        return {
          ...emptyProviderError(),
          category: 'provider_timeout',
          providerMessage: message,
          upstreamStatus: 0,
        };
      }
      const category =
        classifyHttpError(
          context.response.status,
          bodyJson,
          context.response.bodyText,
          message,
          code,
        ) ?? 'provider_unknown';
      return {
        category,
        providerMessage: message,
        providerCode: code,
        upstreamStatus: context.response.status,
      };
    },

    extractUsage(context: ProviderResponseContext): NormalizedChatResponse['usage'] {
      const json = context.response.bodyJson as OpenAIResponsesResponse | null;
      if (!json || typeof json !== 'object' || !json.usage) return null;
      return {
        inputTokens: json.usage.input_tokens ?? 0,
        outputTokens: json.usage.output_tokens ?? 0,
        totalTokens: json.usage.total_tokens ?? 0,
      };
    },
  };
}

export function buildCodexRequest(context: ProviderRequestContext): ProviderHttpRequest {
  return createCodexAdapter().buildRequest(context);
}
