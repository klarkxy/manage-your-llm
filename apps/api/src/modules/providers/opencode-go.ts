import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'opencode-go',
  icon: '🐙',
  name: 'OpenCode Go (International)',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      providerType: 'openai_compatible',
    },
  ],
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
