import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'baichuan',
  icon: '🌊',
  name: 'Baichuan',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.baichuan-ai.com',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('baichuan'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
