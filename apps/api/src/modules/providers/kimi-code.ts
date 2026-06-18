import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'kimi-code',
  icon: '💻',
  name: 'Kimi Code',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.kimi.com/coding',
      providerType: 'anthropic_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
