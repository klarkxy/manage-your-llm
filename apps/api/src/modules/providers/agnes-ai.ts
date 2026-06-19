import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'agnes-ai',
  icon: '✨',
  name: 'Agnes AI',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://apihub.agnes-ai.com/v1',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('agnes-ai'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
