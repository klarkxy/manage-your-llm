import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'qianfan',
  icon: '🌾',
  name: 'Baidu Qianfan (China)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://qianfan.baidubce.com',
      providerType: 'openai_compatible',
      apiPath: '/v2/chat/completions',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
