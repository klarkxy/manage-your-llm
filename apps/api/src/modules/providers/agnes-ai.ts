import type { ProviderModule, ProviderPreset } from './types.js';

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
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
