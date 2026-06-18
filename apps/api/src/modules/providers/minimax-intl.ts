import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'minimax-intl',
  icon: 'Ⓜ️',
  name: 'MiniMax (International)',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.minimax.io/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.minimax.io',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
