export type ProviderType =
  | 'anthropic_compatible'
  | 'openai_compatible'
  | 'coze'
  | 'codex'
  | 'deepseek'
  | 'moonshot'
  | 'minimax'
  | 'openrouter'
  | 'groq'
  | 'fireworks'
  | 'together';

export type SourceProtocol = 'anthropic' | 'openai' | 'codex';

// 将 provider 类型映射到其原生说话的下游协议。
// 例如 Coze 内部使用自己的 wire 协议，但在路由层面按 OpenAI 形态处理，
// 由 adapter 在接到 Anthropic 客户端时进行转换。
export const PROTOCOL_BY_PROVIDER: Readonly<Record<ProviderType, SourceProtocol>> = {
  anthropic_compatible: 'anthropic',
  openai_compatible: 'openai',
  coze: 'openai',
  codex: 'codex',
  deepseek: 'anthropic',
  moonshot: 'anthropic',
  minimax: 'anthropic',
  openrouter: 'openai',
  groq: 'openai',
  fireworks: 'openai',
  together: 'openai',
};

export function protocolFor(providerType: ProviderType): SourceProtocol {
  return PROTOCOL_BY_PROVIDER[providerType];
}

export const ALL_PROVIDER_TYPES: readonly ProviderType[] = [
  'anthropic_compatible',
  'openai_compatible',
  'coze',
  'codex',
  'deepseek',
  'moonshot',
  'minimax',
  'openrouter',
  'groq',
  'fireworks',
  'together',
] as const;

export const ALL_SOURCE_PROTOCOLS: readonly SourceProtocol[] = ['anthropic', 'openai', 'codex'];
