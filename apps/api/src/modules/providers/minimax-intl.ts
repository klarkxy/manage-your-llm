import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'minimax-intl',
  icon: 'Ⓜ️',
  name: 'MiniMax (International)',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.minimax.io/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.minimax.io',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('minimax-intl'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
