import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

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
  guideUrl: providerGuideUrl('qwen'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
