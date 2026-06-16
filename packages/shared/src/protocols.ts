export type ProviderType = "anthropic_compatible" | "openai_compatible";

export type SourceProtocol = "anthropic" | "openai";

export const PROTOCOL_BY_PROVIDER: Readonly<Record<ProviderType, SourceProtocol>> = {
  anthropic_compatible: "anthropic",
  openai_compatible: "openai",
};

export function protocolFor(providerType: ProviderType): SourceProtocol {
  return PROTOCOL_BY_PROVIDER[providerType];
}

export const ALL_PROVIDER_TYPES: readonly ProviderType[] = [
  "anthropic_compatible",
  "openai_compatible",
] as const;

export const ALL_SOURCE_PROTOCOLS: readonly SourceProtocol[] = [
  "anthropic",
  "openai",
] as const;