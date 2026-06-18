import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'together',
  icon: '🤝',
  name: 'Together AI',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.together.xyz',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
