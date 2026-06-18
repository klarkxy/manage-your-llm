import type { ProviderModule, ProviderPreset } from './types.js';
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
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
  createAdapter: () => createCozeAdapter(),
};

export default providerModule;
