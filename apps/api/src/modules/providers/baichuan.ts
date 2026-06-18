import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'baichuan',
  icon: '🌊',
  name: 'Baichuan',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.baichuan-ai.com',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
