import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'qianfan',
  icon: '🌾',
  name: 'Baidu Qianfan',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://qianfan.baidubce.com',
      providerType: 'openai_compatible',
      apiPath: '/v2/chat/completions',
    },
  ],
  guideUrl: providerGuideUrl('qianfan'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
