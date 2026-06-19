import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'openrouter',
  icon: '🌐',
  name: 'OpenRouter',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://openrouter.ai/api',
      providerType: 'openai_compatible',
    },
  ],
  // Public model names are kept provider-agnostic so they can be shared with
  // official-provider presets (e.g. "gpt-4o" also exists under OpenAI). The
  // overrides carry the OpenRouter slug required by the upstream endpoint.
  guideUrl: providerGuideUrl('openrouter'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
