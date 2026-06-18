import type { NormalizedChatResponse } from '@modelharbor/shared';
import type { AnthropicMessagesResponse, OpenAIChatCompletionsResponse } from '@modelharbor/shared';

// Convert the router's internal NormalizedChatResponse into the wire-format
// Anthropic Messages response. The M3 non-stream shape is sufficient for M4.
export function irToAnthropicResponse(
  ir: NormalizedChatResponse,
  args: { model: string },
): AnthropicMessagesResponse {
  const inputTokens = ir.usage?.inputTokens ?? 0;
  const outputTokens = ir.usage?.outputTokens ?? 0;
  return {
    id: ir.id,
    type: 'message',
    role: 'assistant',
    content: ir.content ? [{ type: 'text', text: ir.content }] : [],
    model: args.model,
    stop_reason: ir.stopReason ?? 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

// Convert the router's internal NormalizedChatResponse into the wire-format
// OpenAI Chat Completions response. `created` is the current epoch second.
export function irToOpenAIResponse(
  ir: NormalizedChatResponse,
  args: { model: string },
): OpenAIChatCompletionsResponse {
  return {
    id: ir.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: args.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: ir.content },
        finish_reason: mapStopReasonToOpenAI(ir.stopReason),
      },
    ],
    usage: ir.usage
      ? {
          prompt_tokens: ir.usage.inputTokens,
          completion_tokens: ir.usage.outputTokens,
          total_tokens: ir.usage.totalTokens,
        }
      : undefined,
  };
}

function mapStopReasonToOpenAI(stop: string | null): string {
  if (!stop) return 'stop';
  switch (stop) {
    case 'end_turn':
    case 'stop':
      return 'stop';
    case 'max_tokens':
    case 'length':
      return 'length';
    case 'tool_use':
    case 'tool_calls':
      return 'tool_calls';
    case 'content_filter':
      return 'content_filter';
    default:
      return stop;
  }
}
