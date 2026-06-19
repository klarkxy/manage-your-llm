import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'zhipu',
  icon: '🧬',
  name: 'Zhipu GLM',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://open.bigmodel.cn/api/paas',
      providerType: 'openai_compatible',
      apiPath: '/v4/chat/completions',
    },
  ],
  guideUrl: providerGuideUrl('zhipu'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
