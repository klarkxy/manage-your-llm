import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'xai',
  icon: '🚀',
  name: 'xAI (Grok) (International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.x.ai',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
