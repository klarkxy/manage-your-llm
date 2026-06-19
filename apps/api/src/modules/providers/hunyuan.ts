import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'hunyuan',
  icon: '🐧',
  name: 'Tencent Hunyuan',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.hunyuan.cloud.tencent.com',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('hunyuan'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
