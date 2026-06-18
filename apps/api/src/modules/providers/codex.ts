import type { ProviderModule, ProviderPreset } from './types.js';

const preset: ProviderPreset = {
  id: 'codex',
  icon: '⌨️',
  name: 'OpenAI Codex',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.openai.com',
      providerType: 'openai_compatible',
    },
  ],
  authStrategies: { default: 'codex_oauth', available: ['codex_oauth', 'pat'] },
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
