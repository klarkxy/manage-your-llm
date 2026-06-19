import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'codex',
  icon: '⌨️',
  name: 'OpenAI Codex',
  endpoints: [
    {
      protocol: 'codex',
      baseUrl: 'https://api.openai.com',
      providerType: 'codex',
    },
  ],
  authStrategies: { default: 'codex_oauth', available: ['codex_oauth', 'pat'] },
  guideUrl: providerGuideUrl('codex'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
