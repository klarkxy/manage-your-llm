import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

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
  guideUrl: providerGuideUrl('bytedance'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
