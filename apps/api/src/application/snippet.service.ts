import type { AdminSettingsRow } from '../infrastructure/db/schema.js';
import type { SnippetClient } from '@manageyourllm/contracts';

export interface SnippetInput {
  client: SnippetClient;
  model: string;
  apiKey: string;
  gatewayUrl: string;
}

export interface SnippetResult {
  client: SnippetClient;
  model: string;
  apiKey: string;
  gatewayUrl: string;
  content: string;
}

export class SnippetService {
  generate(input: SnippetInput): SnippetResult {
    const renderer = templates[input.client];
    const content = renderer(input.gatewayUrl, input.apiKey, input.model);
    return {
      client: input.client,
      model: input.model,
      apiKey: input.apiKey,
      gatewayUrl: input.gatewayUrl,
      content,
    };
  }

  buildGatewayUrl(settings: AdminSettingsRow): string {
    const base = (settings.publicBaseUrl ?? '').trim();
    const path = (settings.gatewayBasePath ?? '/v1').trim();
    if (!base) return '';
    const normalizedBase = base.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }
}

const templates: Record<SnippetClient, (baseUrl: string, apiKey: string, model: string) => string> =
  {
    generic_openai: (baseUrl, apiKey, model) =>
      `# Generic OpenAI-compatible client
# Base URL: ${baseUrl}
# API Key:  ${apiKey}
# Model:    ${model}

curl -X POST ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${model}", "messages": [{"role": "user", "content": "Hello"}]}'

# Python openai client example:
# import openai
# client = openai.OpenAI(base_url="${baseUrl}", api_key="${apiKey}")
# response = client.chat.completions.create(model="${model}", messages=[{"role": "user", "content": "Hello"}])
`,

    claude_code: (baseUrl, apiKey, model) =>
      `# Claude Code (claude-code CLI)
# Use Anthropic-compatible endpoint on ManageYourLLM gateway.

export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_API_KEY="${apiKey}"
# Optional: claude-code --model "${model}"
`,

    codex_cli: (baseUrl, apiKey, model) =>
      `# Codex CLI (OpenAI-based)

export OPENAI_BASE_URL="${baseUrl}"
export OPENAI_API_KEY="${apiKey}"
codex --model "${model}"
`,

    opencode: (baseUrl, apiKey, model) =>
      `# OpenCode / Continue / other OpenAI-compatible IDE plugin
# Configure the provider with the fields below:

Base URL: ${baseUrl}
API Key:  ${apiKey}
Model:    ${model}
`,

    hermes: (baseUrl, apiKey, model) =>
      `# Hermes (OpenAI-compatible)
# Set the following in your Hermes config:

base_url = "${baseUrl}"
api_key = "${apiKey}"
model = "${model}"
`,

    cherry_studio: (baseUrl, apiKey, model) =>
      `# Cherry Studio
# Add a custom provider with these fields:

Provider Name: ManageYourLLM
Base URL:      ${baseUrl}
API Key:       ${apiKey}
Model Name:    ${model}
`,
  };
