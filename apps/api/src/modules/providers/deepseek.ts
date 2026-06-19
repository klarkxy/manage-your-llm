import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'deepseek',
  icon: '🐋',
  name: 'DeepSeek',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.deepseek.com/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.deepseek.com',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('deepseek'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
