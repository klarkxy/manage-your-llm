import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'fireworks',
  icon: '🎆',
  name: 'Fireworks AI',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.fireworks.ai/inference',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('fireworks'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
