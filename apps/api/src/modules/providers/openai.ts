import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'openai',
  icon: '🤖',
  name: 'OpenAI (International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.openai.com',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
