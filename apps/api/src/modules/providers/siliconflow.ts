import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'siliconflow',
  icon: '💧',
  name: 'SiliconFlow',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.siliconflow.cn/v1',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('siliconflow'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
