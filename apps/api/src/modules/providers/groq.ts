import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'groq',
  icon: '⚡',
  name: 'Groq',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.groq.com/openai',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
