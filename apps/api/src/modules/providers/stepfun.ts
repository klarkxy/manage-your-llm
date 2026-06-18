import type { ProviderModule, ProviderPreset } from './types.js';

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
};

const providerModule: ProviderModule = {
  id: preset.id,
  preset,
};

export default providerModule;
