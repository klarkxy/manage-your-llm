import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'minimax',
  icon: 'Ⓜ️',
  name: 'MiniMax (China)',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.minimaxi.com/anthropic',
      providerType: 'anthropic_compatible',
    },
    {
      protocol: 'openai',
      baseUrl: 'https://api.minimaxi.com',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('minimax'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
