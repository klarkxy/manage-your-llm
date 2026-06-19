import type { ProviderModule, ProviderPreset } from './types.js';
import { providerGuideUrl } from './guide-url.js';

const preset: ProviderPreset = {
  id: 'stepfun',
  icon: '⬆️',
  name: 'StepFun',
  endpoints: [
    {
      protocol: 'openai',
      baseUrl: 'https://api.stepfun.com',
      providerType: 'openai_compatible',
    },
  ],
  guideUrl: providerGuideUrl('stepfun'),
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
