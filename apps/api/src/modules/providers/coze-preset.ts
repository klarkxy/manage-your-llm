import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';
import { createCozeAdapter } from './coze.js';

const preset: ProviderPreset = {
  id: 'coze',
  icon: '🤖',
  name: 'Coze',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.coze.cn',
      providerType: 'coze',
      apiPath: '/v3/chat',
    },
  ],
  authStrategies: {
    default: 'coze_oauth_jwt',
    // OAuth PKCE is implemented but hidden until Coze supports a public
    // browser client that can redirect to arbitrary dashboards.
    available: ['coze_oauth_jwt', 'pat'],
  },
  guideUrl: providerGuideUrl('coze'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
  createAdapter: () => createCozeAdapter(),
};

export default providerModule;
