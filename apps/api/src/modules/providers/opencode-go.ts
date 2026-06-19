import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'opencode-go',
  icon: '🐙',
  name: 'OpenCode Go',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('opencode-go'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
