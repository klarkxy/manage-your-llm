import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'groq',
  icon: '⚡',
  name: 'Groq',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.groq.com/openai',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('groq'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
