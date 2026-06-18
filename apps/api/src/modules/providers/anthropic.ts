import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'anthropic',
  icon: '🟣',
  name: 'Anthropic',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      providerType: 'anthropic_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
