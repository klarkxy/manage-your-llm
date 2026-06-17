import type { ProviderType } from "@modelharbor/shared";
import { createAnthropicCompatibleAdapter } from "./anthropic-compatible.js";
import { createOpenAICompatibleAdapter } from "./openai-compatible.js";
import type { ProviderAdapter } from "./types.js";

const REGISTRY: Readonly<Record<ProviderType, () => ProviderAdapter>> = {
  anthropic_compatible: createAnthropicCompatibleAdapter,
  openai_compatible: createOpenAICompatibleAdapter,
};

export function getAdapter(type: ProviderType): ProviderAdapter {
  const factory = REGISTRY[type];
  if (!factory) {
    throw new Error(`no adapter registered for provider type: ${type}`);
  }
  return factory();
}

export function listProviderTypes(): readonly ProviderType[] {
  return Object.keys(REGISTRY) as ProviderType[];
}