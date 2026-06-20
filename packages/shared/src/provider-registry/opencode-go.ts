import type { SourceProtocol } from '../protocols.js';

const OPENCODE_GO_OPENAI_MODELS = new Set([
  'glm-5.2',
  'glm-5.1',
  'kimi-k2.7',
  'kimi-k2.7-code',
  'kimi-k2.6',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'mimo-v2.5',
  'mimo-v2.5-pro',
]);

const OPENCODE_GO_ANTHROPIC_MODELS = new Set([
  'minimax-m3',
  'minimax-m2.7',
  'minimax-m2.5',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.6-plus',
]);

function normalizeOpenCodeGoModelName(modelName: string): string {
  return modelName.trim().replace(/^opencode-go\//, '');
}

export function opencodeGoEndpointProtocolForModel(modelName: string): SourceProtocol | null {
  const normalized = normalizeOpenCodeGoModelName(modelName);
  if (OPENCODE_GO_ANTHROPIC_MODELS.has(normalized)) return 'anthropic';
  if (OPENCODE_GO_OPENAI_MODELS.has(normalized)) return 'openai';
  return null;
}
