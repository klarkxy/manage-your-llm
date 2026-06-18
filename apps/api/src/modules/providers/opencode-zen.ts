import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'opencode-zen',
  icon: '🐙',
  name: 'OpenCode Zen (International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://opencode.ai/zen/v1',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
