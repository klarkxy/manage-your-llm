import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'xai',
  icon: '🚀',
  name: 'xAI (Grok)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.x.ai',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('xai'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
