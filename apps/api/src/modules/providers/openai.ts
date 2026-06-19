import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'openai',
  icon: '🤖',
  name: 'OpenAI',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.openai.com',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('openai'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
