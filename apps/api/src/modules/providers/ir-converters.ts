import type {
  AnthropicMessage,
  AnthropicMessagesRequest,
  ChatMessageIR,
  ChatRequestIR,
  OpenAIChatCompletionsRequest,
  OpenAIChatMessage,
} from '@modelharbor/shared';

function extractAnthropicText(content: AnthropicMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
      const t = (block as { text?: string }).text;
      if (typeof t === 'string') parts.push(t);
    }
  }
  return parts.join('');
}

function extractAnthropicSystem(system: AnthropicMessagesRequest['system']): string | null {
  if (!system) return null;
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    const parts: string[] = [];
    for (const block of system) {
      if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
        const t = (block as { text?: string }).text;
        if (typeof t === 'string') parts.push(t);
      }
    }
    return parts.length > 0 ? parts.join('') : null;
  }
  return null;
}

export function anthropicRequestToIR(
  body: AnthropicMessagesRequest,
  rawRequest: unknown = body,
): ChatRequestIR {
  const messages: ChatMessageIR[] = [];
  for (const m of body.messages ?? []) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    messages.push({
      role: m.role,
      content: extractAnthropicText(m.content),
    });
  }
  const metadata: Record<string, string> = {};
  if (
    body.metadata &&
    typeof body.metadata === 'object' &&
    typeof (body.metadata as { user_id?: unknown }).user_id === 'string'
  ) {
    metadata['user_id'] = (body.metadata as { user_id: string }).user_id;
  }
  return {
    sourceProtocol: 'anthropic',
    requestedModel: body.model,
    system: extractAnthropicSystem(body.system),
    messages,
    maxTokens: body.max_tokens ?? null,
    temperature: body.temperature ?? null,
    topP: body.top_p ?? null,
    stream: body.stream === true,
    metadata,
    rawRequest,
  };
}

function extractOpenAIText(content: OpenAIChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (content === null || content === undefined) return '';
  if (typeof content === 'object' && content !== null) {
    // OpenAI vision content is an array of parts; for M3 we just join text parts.
    const arr = content as unknown[];
    if (Array.isArray(arr)) {
      const parts: string[] = [];
      for (const p of arr) {
        if (p && typeof p === 'object' && (p as { type?: string }).type === 'text') {
          const t = (p as { text?: string }).text;
          if (typeof t === 'string') parts.push(t);
        }
      }
      return parts.join('');
    }
  }
  return '';
}

export function openaiRequestToIR(
  body: OpenAIChatCompletionsRequest,
  rawRequest: unknown = body,
): ChatRequestIR {
  const messages: ChatMessageIR[] = [];
  let system: string | null = null;
  for (const m of body.messages ?? []) {
    if (m.role === 'system') {
      const t = extractOpenAIText(m.content);
      if (system) {
        system = system + '\n' + t;
      } else {
        system = t;
      }
      continue;
    }
    if (m.role === 'user') {
      messages.push({ role: 'user', content: extractOpenAIText(m.content) });
      continue;
    }
    if (m.role === 'assistant') {
      messages.push({ role: 'assistant', content: extractOpenAIText(m.content) });
      continue;
    }
    if (m.role === 'tool') {
      const id = typeof m.tool_call_id === 'string' ? m.tool_call_id : undefined;
      messages.push({
        role: 'tool',
        content: extractOpenAIText(m.content),
        ...(id ? { toolCallId: id } : {}),
      });
      continue;
    }
    // "function" role is legacy OpenAI; treat as tool.
    if (m.role === 'function') {
      const id = typeof m.name === 'string' ? m.name : undefined;
      messages.push({
        role: 'tool',
        content: extractOpenAIText(m.content),
        ...(id ? { toolCallId: id } : {}),
      });
    }
  }
  const metadata: Record<string, string> = {};
  if (typeof body.user === 'string') metadata['user_id'] = body.user;
  return {
    sourceProtocol: 'openai',
    requestedModel: body.model,
    system,
    messages,
    maxTokens: body.max_tokens ?? null,
    temperature: body.temperature ?? null,
    topP: body.top_p ?? null,
    stream: body.stream === true,
    metadata,
    rawRequest,
  };
}
