import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'kimi-code',
  icon: '💻',
  name: 'Kimi Code',
  endpoints: [
    {
      protocol: 'anthropic',
      baseUrl: 'https://api.kimi.com/coding',
      providerType: 'anthropic_compatible',
    },
  ],
  guideUrl: providerGuideUrl('kimi-code'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
