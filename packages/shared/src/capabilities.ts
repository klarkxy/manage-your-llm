import type { SourceProtocol } from './protocols.js';

export type UsageAvailability = 'always' | 'on_demand' | 'unavailable';

export interface ProviderCapabilities {
  protocols: readonly SourceProtocol[];
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  supportsTools: boolean;
  supportsToolChoice: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  supportsThinking: boolean;
  usageAvailability: UsageAvailability;
}
