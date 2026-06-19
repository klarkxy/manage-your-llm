import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'moonshot-cn',
  icon: '🌙',
  name: 'Moonshot (Kimi) (China)',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.moonshot.cn/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.moonshot.cn',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('moonshot-cn'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
