import { ProviderError, type ProviderType } from '@manageyourllm/shared';
import type { ProviderAdapter } from './adapter.js';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter.js';
import { AnthropicCompatibleAdapter } from './anthropic-compatible.adapter.js';

const openaiAdapter = new OpenAICompatibleAdapter();
const anthropicAdapter = new AnthropicCompatibleAdapter();

const registry: Record<ProviderType, ProviderAdapter> = {
  openai_compatible: openaiAdapter,
  coze: openaiAdapter,
  codex: openaiAdapter,
  openrouter: openaiAdapter,
  groq: openaiAdapter,
  fireworks: openaiAdapter,
  together: openaiAdapter,
  moonshot: anthropicAdapter,
  minimax: anthropicAdapter,
  anthropic_compatible: anthropicAdapter,
  deepseek: anthropicAdapter,
};

export function getProviderAdapter(providerType: ProviderType): ProviderAdapter {
  const adapter = registry[providerType];
  if (!adapter) {
    throw new ProviderError(`不支持的 provider 类型: ${providerType}`, { status: 500 });
  }
  return adapter;
}
