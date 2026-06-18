import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'qwen-intl',
  icon: '🌸',
  name: 'Alibaba Qwen (DashScope International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
