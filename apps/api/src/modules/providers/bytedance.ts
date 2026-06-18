import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'bytedance',
  icon: '🌋',
  name: 'ByteDance Volcano Ark',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://ark.cn-beijing.volces.com/api',
      providerType: 'openai_compatible',
      apiPath: '/v3/chat/completions',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
