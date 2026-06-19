import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

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
  guideUrl: providerGuideUrl('qwen-intl'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
