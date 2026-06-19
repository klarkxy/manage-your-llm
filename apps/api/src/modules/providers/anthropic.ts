import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'anthropic',
  icon: '🟣',
  name: 'Anthropic',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      providerType: 'anthropic_compatible',
    },
  ],
  guideUrl: providerGuideUrl('anthropic'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
