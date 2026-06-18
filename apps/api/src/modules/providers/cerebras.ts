import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'cerebras',
  icon: '🧠',
  name: 'Cerebras (International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.cerebras.ai',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
