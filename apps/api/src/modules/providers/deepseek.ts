import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'deepseek',
  icon: '🐋',
  name: 'DeepSeek',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.deepseek.com/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.deepseek.com',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
