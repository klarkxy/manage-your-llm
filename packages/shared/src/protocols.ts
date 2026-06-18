export type ProviderType = 'anthropic_compatible' | 'openai_compatible' | 'coze' | 'codex';

export type SourceProtocol = 'anthropic' | 'openai' | 'codex';

// Maps a provider type to the client protocol it natively speaks. Providers
// such as Coze use their own wire protocol; they are treated as OpenAI-shaped
// for routing purposes and rely on the adapter to translate when serving
// Anthropic clients.
export const PROTOCOL_BY_PROVIDER: Readonly<Record<ProviderType, SourceProtocol>> = {
  anthropic_compatible: 'anthropic',
  openai_compatible: 'openai',
  coze: 'openai',
  codex: 'codex',
};

export function protocolFor(providerType: ProviderType): SourceProtocol {
  return PROTOCOL_BY_PROVIDER[providerType];
}

export const ALL_PROVIDER_TYPES: readonly ProviderType[] = [
  'anthropic_compatible',
  'openai_compatible',
  'coze',
  'codex',
] as const;

export const ALL_SOURCE_PROTOCOLS: readonly SourceProtocol[] = [
  'anthropic',
  'openai',
  'codex',
] as const;
