import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'qwen',
  icon: '🌸',
  name: 'Alibaba Qwen (DashScope China)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
