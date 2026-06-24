import type {
  ProviderDescriptor,
  ProviderDescriptorAuthStrategies,
  ProviderDescriptorCapabilities,
  ProviderDescriptorEndpoint,
} from './descriptor.js';

function capabilities(endpoints: ProviderDescriptorEndpoint[]): ProviderDescriptorCapabilities {
  const protocols = Array.from(new Set(endpoints.map((e) => e.protocol)));
  return {
    protocols,
    supportsTools: false,
    supportsToolChoice: false,
    supportsVision: false,
    supportsJsonMode: false,
    supportsThinking: false,
  };
}

function preset(desc: Omit<ProviderDescriptor, 'capabilities'>): ProviderDescriptor {
  return {
    ...desc,
    capabilities: capabilities(desc.endpoints),
  };
}

export const PROVIDER_PRESETS: readonly ProviderDescriptor[] = [
  preset({
    id: 'anthropic',
    metadata: {
      displayName: 'Anthropic',
      docsUrl: 'https://docs.anthropic.com',
      apiKeyUrl: 'https://console.anthropic.com/settings/keys',
      statusPageUrl: 'https://status.anthropic.com',
    },
    branding: { icon: '🟣', color: '#D4A574' },
    endpoints: [
      {
        protocol: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        providerType: 'anthropic_compatible',
      },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/anthropic.md',
    defaultModel: 'claude-3-5-sonnet-20241022',
    modelExamples: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ],
  }),
  preset({
    id: 'openai',
    metadata: {
      displayName: 'OpenAI',
      docsUrl: 'https://platform.openai.com/docs',
      apiKeyUrl: 'https://platform.openai.com/api-keys',
      statusPageUrl: 'https://status.openai.com',
    },
    branding: { icon: '🤖', color: '#10A37F' },
    endpoints: [
      { protocol: 'openai', baseUrl: 'https://api.openai.com', providerType: 'openai_compatible' },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/openai.md',
    defaultModel: 'gpt-4o-mini',
    modelExamples: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  }),
  preset({
    id: 'codex',
    metadata: {
      displayName: 'OpenAI Codex',
      docsUrl: 'https://platform.openai.com/docs',
      apiKeyUrl: 'https://platform.openai.com/api-keys',
    },
    branding: { icon: '⌨️' },
    endpoints: [{ protocol: 'codex', baseUrl: 'https://api.openai.com', providerType: 'codex' }],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/codex.md',
    defaultModel: 'codex-mini-latest',
  }),
  preset({
    id: 'deepseek',
    metadata: {
      displayName: 'DeepSeek',
      docsUrl: 'https://api-docs.deepseek.com',
      apiKeyUrl: 'https://platform.deepseek.com',
    },
    branding: { icon: '🐋' },
    endpoints: [
      {
        protocol: 'anthropic',
        baseUrl: 'https://api.deepseek.com/anthropic',
        providerType: 'anthropic_compatible',
      },
      {
        protocol: 'openai',
        baseUrl: 'https://api.deepseek.com',
        providerType: 'openai_compatible',
      },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/deepseek.md',
    defaultModel: 'deepseek-chat',
    modelExamples: ['deepseek-chat', 'deepseek-reasoner'],
  }),
  preset({
    id: 'openrouter',
    metadata: { displayName: 'OpenRouter' },
    branding: { icon: '🌐' },
    endpoints: [
      {
        protocol: 'openai',
        baseUrl: 'https://openrouter.ai/api',
        providerType: 'openai_compatible',
      },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/openrouter.md',
  }),
  preset({
    id: 'groq',
    metadata: { displayName: 'Groq' },
    branding: { icon: '⚡' },
    endpoints: [
      {
        protocol: 'openai',
        baseUrl: 'https://api.groq.com/openai',
        providerType: 'openai_compatible',
      },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/groq.md',
  }),
  preset({
    id: 'fireworks',
    metadata: { displayName: 'Fireworks AI' },
    branding: { icon: '🎆' },
    endpoints: [
      {
        protocol: 'openai',
        baseUrl: 'https://api.fireworks.ai/inference',
        providerType: 'openai_compatible',
      },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/fireworks.md',
  }),
  preset({
    id: 'together',
    metadata: { displayName: 'Together AI' },
    branding: { icon: '🤝' },
    endpoints: [
      {
        protocol: 'openai',
        baseUrl: 'https://api.together.xyz',
        providerType: 'openai_compatible',
      },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/together.md',
  }),
  preset({
    id: 'moonshot',
    metadata: { displayName: 'Moonshot (Kimi)' },
    branding: { icon: '🌙' },
    endpoints: [
      {
        protocol: 'anthropic',
        baseUrl: 'https://api.moonshot.ai/anthropic',
        providerType: 'anthropic_compatible',
      },
      { protocol: 'openai', baseUrl: 'https://api.moonshot.ai', providerType: 'openai_compatible' },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/moonshot.md',
    defaultModel: 'moonshot-v1-8k',
  }),
  preset({
    id: 'minimax',
    metadata: { displayName: 'MiniMax' },
    branding: { icon: 'Ⓜ️' },
    endpoints: [
      {
        protocol: 'anthropic',
        baseUrl: 'https://api.minimax.io/anthropic',
        providerType: 'anthropic_compatible',
      },
      { protocol: 'openai', baseUrl: 'https://api.minimax.io', providerType: 'openai_compatible' },
    ],
    authStrategies: {
      default: 'pat',
      available: ['pat'],
    } as ProviderDescriptorAuthStrategies,
    guideUrl: '/docs/provider-guides/minimax.md',
  }),
].sort((a, b) => a.metadata.displayName.localeCompare(b.metadata.displayName));

const PRESETS_BY_ID: Readonly<Record<string, ProviderDescriptor>> = Object.fromEntries(
  PROVIDER_PRESETS.map((d) => [d.id, d]),
);

export function getProviderDescriptor(id: string): ProviderDescriptor | undefined {
  return PRESETS_BY_ID[id];
}

export function listProviderDescriptors(): readonly ProviderDescriptor[] {
  return PROVIDER_PRESETS;
}
