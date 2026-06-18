import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'fireworks',
  icon: '🎆',
  name: 'Fireworks AI (International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.fireworks.ai/inference',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
