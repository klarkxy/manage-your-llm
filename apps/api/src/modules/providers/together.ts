import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'together',
  icon: '🤝',
  name: 'Together AI',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.together.xyz',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('together'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
