import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'siliconflow',
  icon: '💧',
  name: 'SiliconFlow (China)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.siliconflow.cn/v1',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
