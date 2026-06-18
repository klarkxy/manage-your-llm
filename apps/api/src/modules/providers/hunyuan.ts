import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'hunyuan',
  icon: '🐧',
  name: 'Tencent Hunyuan (China)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.hunyuan.cloud.tencent.com',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
