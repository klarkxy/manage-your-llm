import type { ProviderType, SourceProtocol } from '../protocols.js';

export interface ProviderMetadata {
  // Human-readable name. Use this when no i18n translation exists.
  displayName: string;
  // Link to official API documentation.
  docsUrl?: string;
  // Link to public status page (e.g. Statuspage.io).
  statusPageUrl?: string;
  // Link to where an admin can obtain an API key.
  apiKeyUrl?: string;
}

export interface ProviderBranding {
  // Emoji, SVG filename, or any identifier the frontend understands.
  icon?: string;
  // Primary brand color as hex/rgb string, for UI accents.
  color?: string;
}

export interface ProviderDescriptorCapabilities {
  // Client protocols this provider can serve through its endpoints.
  protocols: readonly SourceProtocol[];
  supportsTools: boolean;
  supportsToolChoice: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  supportsThinking: boolean;
}

export interface ProviderDescriptorAuthStrategies {
  // Default strategy selected when the preset is used.
  default: string;
  // All strategies available for this provider.
  available: string[];
}

export interface ProviderDescriptorEndpoint {
  // Client protocol this endpoint serves.
  protocol: SourceProtocol;
  // Upstream base URL for this endpoint.
  baseUrl: string;
  // Adapter used to talk to this endpoint.
  providerType: ProviderType;
  // Optional full request path override.
  apiPath?: string;
}

export interface ProviderDescriptor {
  // Stable identifier. Used as i18n key `providers.{id}` and DB preset id.
  id: string;
  metadata: ProviderMetadata;
  branding?: ProviderBranding;
  // Static capability declaration for routing/filtering.
  capabilities: ProviderDescriptorCapabilities;
  endpoints: ProviderDescriptorEndpoint[];
  // Extra headers sent on every request (e.g. anthropic-version).
  defaultHeaders?: Record<string, string>;
  // Default extra headers / body params for this provider.
  defaultExtraHeaders?: Record<string, string>;
  defaultExtraParams?: Record<string, unknown>;
  // Supported authentication strategies.
  authStrategies?: ProviderDescriptorAuthStrategies;
  // Link to a setup guide in the web app.
  guideUrl?: string;
  // Relative or absolute URL used for model list synchronization (8.4).
  // When omitted, the sync job falls back to `/v1/models` on the OpenAI-compatible endpoint.
  modelSyncUrl?: string;
  // Default model name used for ping / health checks.
  defaultModel?: string;
  // Example model names shown in the admin UI.
  modelExamples?: string[];
}

export function descriptorDefaultEndpoint(descriptor: ProviderDescriptor): ProviderDescriptorEndpoint {
  if (descriptor.endpoints.length === 0) {
    throw new Error(`provider descriptor ${descriptor.id} has no endpoints`);
  }
  return descriptor.endpoints[0]!;
}

export function descriptorDiscoveryEndpoint(
  descriptor: ProviderDescriptor,
): ProviderDescriptorEndpoint {
  // Prefer the OpenAI-compatible endpoint for /v1/models discovery.
  const openaiEndpoint = descriptor.endpoints.find((e) => e.providerType === 'openai_compatible');
  return openaiEndpoint ?? descriptorDefaultEndpoint(descriptor);
}
