import {
  type ChatRequestIR,
  type NormalizedChatResponse,
  type ProviderCapabilities,
  type ProviderType,
} from '@modelharbor/shared';
import { randomBytes } from 'node:crypto';
import type {
  NormalizedProviderError,
  ProviderAdapter,
  ProviderErrorContext,
  ProviderHttpRequest,
  ProviderRequestContext,
  ProviderResponseContext,
  ProviderStreamClientFrame,
  ProviderStreamEventContext,
  ProviderStreamEventResult,
} from './types.js';
import { safeJsonParse } from './errors.js';

const COZE_CHAT_PATH = '/v3/chat';
const DEFAULT_COZE_USER_ID = 'modelharbor-user';

// Coze only exposes text answers through the streaming (SSE) channel. The
// non-streaming /v3/chat endpoint returns a Chat object that must be polled,
// which the gateway does not support. We therefore always ask Coze for a
// stream and either translate it live (client streaming) or parse the
// accumulated SSE body (client non-streaming).

interface CozeMessage {
  role: 'user' | 'assistant';
  content: string;
  content_type: 'text';
}

interface CozeRequestBody {
  bot_id: string;
  user_id: string;
  additional_messages: CozeMessage[];
  stream: boolean;
  auto_save_history: boolean;
  [key: string]: unknown;
}

interface CozeEventData {
  id?: string;
  conversation_id?: string;
  chat_id?: string;
  bot_id?: string;
  role?: string;
  type?: string;
  content?: string;
  content_type?: string;
  usage?: {
    input_count?: number;
    output_count?: number;
    token_count?: number;
  };
}

interface CozeErrorBody {
  code?: number;
  msg?: string;
}

function parseSse(bodyText: string): Array<{ event: string | null; data: string }> {
  const out: Array<{ event: string | null; data: string }> = [];
  for (const block of bodyText.split(/\n\n/)) {
    const trimmed = block.replace(/\r$/, '').trim();
    if (trimmed.length === 0) continue;
    let event: string | null = null;
    const dataParts: string[] = [];
    for (const line of trimmed.split(/\n/)) {
      if (line.length === 0) continue;
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const field = line.slice(0, colon);
      let value = line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') dataParts.push(value);
    }
    if (dataParts.length > 0) out.push({ event, data: dataParts.join('\n') });
  }
  return out;
}

function extractUsageFromEvent(data: CozeEventData | null): NormalizedChatResponse['usage'] {
  const usage = data?.usage;
  if (!usage) return null;
  const inputTokens = typeof usage.input_count === 'number' ? usage.input_count : 0;
  const outputTokens = typeof usage.output_count === 'number' ? usage.output_count : 0;
  const totalTokens =
    typeof usage.token_count === 'number' ? usage.token_count : inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function irMessagesToCoze(messages: ChatRequestIR['messages']): CozeMessage[] {
  const out: CozeMessage[] = [];
  for (const m of messages) {
    if (m.role === 'user' || m.role === 'assistant') {
      out.push({ role: m.role, content: m.content, content_type: 'text' });
    }
  }
  return out;
}

function buildRequestBody(context: ProviderRequestContext): CozeRequestBody {
  const userId =
    typeof context.ir.metadata['user_id'] === 'string'
      ? (context.ir.metadata['user_id'] as string)
      : DEFAULT_COZE_USER_ID;

  return {
    ...(context.extraParams ?? {}),
    bot_id: context.realModelName,
    user_id: userId,
    additional_messages: irMessagesToCoze(context.ir.messages),
    // Coze non-streaming requires polling; we always stream and either translate
    // the SSE frames or aggregate them in normalizeResponse.
    stream: true,
    auto_save_history: true,
  };
}

function buildRequest(context: ProviderRequestContext): ProviderHttpRequest {
  const body = buildRequestBody(context);
  const base = context.baseUrl.replace(/\/+$/, '');
  const path = context.apiPath ?? COZE_CHAT_PATH;
  const url = new URL(`${base}${path}`);

  // Optional conversation id can be supplied via extraParams.
  const conversationId = context.extraParams?.conversation_id;
  if (typeof conversationId === 'string' && conversationId.length > 0) {
    url.searchParams.set('conversation_id', conversationId);
  }

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      ...(context.extraHeaders ?? {}),
      'content-type': 'application/json',
      authorization: `Bearer ${context.apiKey}`,
    },
    body: JSON.stringify(body),
  };
}

function normalizeResponse(context: ProviderResponseContext): NormalizedChatResponse {
  const events = parseSse(context.response.bodyText);
  let content = '';
  let finalEvent: CozeEventData | null = null;
  let finalUsageEvent: CozeEventData | null = null;

  for (const ev of events) {
    if (ev.event === 'conversation.message.completed') {
      const data = safeJsonParse(ev.data) as CozeEventData | null;
      if (data?.role === 'assistant' && data?.type === 'answer') {
        content = data.content ?? '';
        finalEvent = data;
      }
    } else if (ev.event === 'conversation.chat.completed') {
      const data = safeJsonParse(ev.data) as CozeEventData | null;
      if (data?.usage) {
        finalUsageEvent = data;
      }
    }
  }

  // Fallback: if no completed event arrived, concatenate deltas.
  if (!finalEvent) {
    const parts: string[] = [];
    for (const ev of events) {
      if (ev.event === 'conversation.message.delta') {
        const data = safeJsonParse(ev.data) as CozeEventData | null;
        if (data?.role === 'assistant' && data?.type === 'answer' && data.content) {
          parts.push(data.content);
        }
      }
    }
    content = parts.join('');
  }

  const usage = extractUsageFromEvent(finalUsageEvent) ?? extractUsageFromEvent(finalEvent);

  return {
    id: finalEvent?.id ?? finalUsageEvent?.id ?? `chat_${randomBytes(12).toString('base64url')}`,
    model: context.request.realModelName,
    content,
    stopReason: 'stop',
    usage,
    rawResponse: context.response.bodyJson ?? context.response.bodyText,
  };
}

function cozeErrorCategory(status: number, code?: number): NormalizedProviderError['category'] {
  if (status >= 500) return 'provider_unknown';
  // Coze-specific error codes (https://www.coze.cn/docs/developer_guides/error_code)
  if (code !== undefined) {
    if (code >= 5000) return 'provider_unknown';
    if (code >= 4000 && code < 5000) {
      if (code === 4016) return 'provider_bad_request'; // existing chat in progress
      if (code === 4030 || code === 4031) return 'provider_rate_limit';
      if (code === 4040 || code === 4041) return 'provider_model_not_found';
      if (code === 4020 || code === 4021) return 'provider_quota';
      if (code === 4010 || code === 4011) return 'provider_authentication';
      return 'provider_bad_request';
    }
  }
  if (status === 401) return 'provider_authentication';
  if (status === 403) return 'provider_permission';
  if (status === 404) return 'provider_model_not_found';
  if (status === 408 || status === 504 || status === 524) return 'provider_timeout';
  if (status === 429) return 'provider_rate_limit';
  if (status === 503) return 'provider_overloaded';
  if (status >= 400 && status < 500) return 'provider_bad_request';
  return 'provider_unknown';
}

function normalizeError(context: ProviderErrorContext): NormalizedProviderError {
  if (!context.response) {
    const msg =
      context.transportError instanceof Error
        ? context.transportError.message
        : String(context.transportError ?? 'upstream error');
    return {
      category: 'provider_timeout',
      providerMessage: msg,
      providerCode: null,
      upstreamStatus: 0,
    };
  }

  const bodyJson = safeJsonParse(context.response.bodyText) as CozeErrorBody | null;
  const code = bodyJson?.code;
  const message = bodyJson?.msg ?? null;

  return {
    category: cozeErrorCategory(context.response.status, code),
    providerMessage: message,
    providerCode: code !== undefined ? String(code) : null,
    upstreamStatus: context.response.status,
  };
}

function extractUsage(context: ProviderResponseContext): NormalizedChatResponse['usage'] {
  return normalizeResponse(context).usage;
}

function makeStreamId(): string {
  return `sse_${randomBytes(12).toString('base64url')}`;
}

function openaiDeltaFrame(
  request: ProviderRequestContext,
  data: CozeEventData,
  text: string,
  finishReason: string | null,
): ProviderStreamClientFrame {
  return {
    data: JSON.stringify({
      id: data.id ?? makeStreamId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: request.realModelName,
      choices: [
        {
          index: 0,
          delta: finishReason ? {} : { content: text },
          finish_reason: finishReason,
        },
      ],
    }),
  };
}

function openaiUsageFrame(
  usage: NonNullable<NormalizedChatResponse['usage']>,
): ProviderStreamClientFrame {
  return {
    data: JSON.stringify({
      id: makeStreamId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: '',
      choices: [],
      usage: {
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
      },
    }),
  };
}

function anthropicDeltaFrames(
  request: ProviderRequestContext,
  text: string,
  isFirst: boolean,
): ProviderStreamClientFrame[] {
  const frames: ProviderStreamClientFrame[] = [];
  if (isFirst) {
    frames.push({
      event: 'message_start',
      data: JSON.stringify({
        type: 'message_start',
        message: {
          id: `msg_${randomBytes(12).toString('base64url')}`,
          type: 'message',
          role: 'assistant',
          content: [],
          model: request.realModelName,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }),
    });
    frames.push({
      event: 'content_block_start',
      data: JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
    });
  }
  frames.push({
    event: 'content_block_delta',
    data: JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    }),
  });
  return frames;
}

function anthropicStopFrames(usage: NormalizedChatResponse['usage']): ProviderStreamClientFrame[] {
  const frames: ProviderStreamClientFrame[] = [
    {
      event: 'content_block_stop',
      data: JSON.stringify({ type: 'content_block_stop', index: 0 }),
    },
  ];
  if (usage) {
    frames.push({
      event: 'message_delta',
      data: JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: usage.outputTokens },
      }),
    });
  }
  frames.push({
    event: 'message_stop',
    data: JSON.stringify({ type: 'message_stop' }),
  });
  return frames;
}

export function createCozeAdapter(): ProviderAdapter {
  // Tracks whether we have already emitted the Anthropic message_start /
  // content_block_start frames for the current stream.
  let anthropicStarted = false;

  function normalizeStreamEvent(context: ProviderStreamEventContext): ProviderStreamEventResult {
    const { event, data, sourceProtocol } = context;

    if (event === 'conversation.message.delta') {
      const parsed = safeJsonParse(data) as CozeEventData | null;
      if (parsed?.role === 'assistant' && parsed?.type === 'answer') {
        const text = parsed.content ?? '';
        if (sourceProtocol === 'openai') {
          return {
            kind: 'delta',
            text,
            clientFrame: openaiDeltaFrame(context.request, parsed, text, null),
          };
        }
        const isFirst = !anthropicStarted;
        anthropicStarted = true;
        return {
          kind: 'delta',
          text,
          clientFrame: anthropicDeltaFrames(context.request, text, isFirst),
        };
      }
    }

    if (event === 'conversation.message.completed') {
      const parsed = safeJsonParse(data) as CozeEventData | null;
      if (parsed?.role === 'assistant' && parsed?.type === 'answer') {
        const text = parsed.content ?? '';
        const usage = extractUsageFromEvent(parsed);
        if (sourceProtocol === 'openai') {
          const frames: ProviderStreamClientFrame[] = [
            openaiDeltaFrame(context.request, parsed, text, 'stop'),
          ];
          if (usage) frames.push(openaiUsageFrame(usage));
          return { kind: 'stop', reason: 'stop', clientFrame: frames };
        }
        return { kind: 'stop', reason: 'stop', clientFrame: anthropicStopFrames(usage) };
      }
    }

    if (event === 'conversation.chat.completed') {
      const parsed = safeJsonParse(data) as CozeEventData | null;
      const usage = extractUsageFromEvent(parsed);
      if (usage && sourceProtocol === 'openai') {
        return { kind: 'usage', ...usage, clientFrame: openaiUsageFrame(usage) };
      }
      return { kind: 'usage', ...(usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }) };
    }

    if (event === 'done') {
      if (sourceProtocol === 'openai') {
        return { kind: 'stop', reason: 'stop', clientFrame: { data: '[DONE]' } };
      }
      return { kind: 'stop', reason: 'stop' };
    }

    // conversation.chat.created, answer events, pings, etc.
    return { kind: 'ignored' };
  }

  return {
    type: 'coze' as ProviderType,
    capabilities: {
      protocols: ['openai', 'anthropic'],
      supportsStreaming: true,
      supportsSystemPrompt: false,
      supportsTools: false,
      supportsToolChoice: false,
      supportsVision: false,
      supportsJsonMode: false,
      supportsThinking: false,
      usageAvailability: 'on_demand',
    } satisfies ProviderCapabilities,
    buildRequest,
    normalizeResponse,
    normalizeStreamEvent,
    normalizeError,
    extractUsage,
  };
}
