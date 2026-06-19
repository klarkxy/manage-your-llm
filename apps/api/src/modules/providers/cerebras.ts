import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'cerebras',
  icon: '🧠',
  name: 'Cerebras',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.cerebras.ai',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('cerebras'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
