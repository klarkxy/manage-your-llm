import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'moonshot',
  icon: '🌙',
  name: 'Moonshot (Kimi) (International)',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.moonshot.ai/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.moonshot.ai',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
