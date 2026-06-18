import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'moonshot-cn',
  icon: '🌙',
  name: 'Moonshot (Kimi) (China)',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.moonshot.cn/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.moonshot.cn',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
