# Provider Adapter Guide

## Purpose

Provider adapters isolate upstream-provider differences from the router core.

The router decides:

- Which target the client requested.
- Which consumer key and app are calling.
- Which upstream key and real model should be used.
- Whether sticky routing, quota, cooldown, and permissions allow the route.

The provider adapter decides:

- How to authenticate to the upstream provider.
- Which URL and path to call.
- How to convert the internal request into provider format.
- How to convert provider responses and stream events back to the client protocol.
- How to normalize provider errors.
- How to extract token usage.

## MVP Adapters

MVP adapters:

- `anthropic_compatible`
- `openai_compatible`

Future adapters can be added without changing the router core:

- `deepseek`
- `qwen`
- `openrouter`
- `vertex`
- `gemini`
- `custom`

## Adapter Contract

Recommended TypeScript shape:

```ts
export interface ProviderAdapter {
  type: ProviderType;
  capabilities: ProviderCapabilities;

  buildRequest(context: ProviderRequestContext): Promise<ProviderHttpRequest>;
  normalizeResponse(context: ProviderResponseContext): Promise<ClientResponse>;
  normalizeStreamEvent(context: ProviderStreamEventContext): ProviderStreamEventResult;
  normalizeError(error: unknown): NormalizedProviderError;
  extractUsage(context: ProviderUsageContext): ProviderUsage | null;
}
```

The final implementation can adjust names, but the separation should remain.

## Capabilities

Each adapter must declare capabilities so the router can filter incompatible candidates before sending traffic.

Initial capabilities:

```text
ProviderCapabilities
- protocols
- supportsStreaming
- supportsSystemPrompt
- supportsTools
- supportsToolChoice
- supportsVision
- supportsJsonMode
- supportsThinking
- usageAvailability
```

MVP only requires:

- Text messages.
- System prompt where supported.
- Non-stream and stream response.
- Usage extraction when provider returns usage.

Unsupported request features should fail clearly or be ignored only when safe and documented.

## Request Context

The router passes resolved state to adapters.

Recommended fields:

```text
ProviderRequestContext
- sourceProtocol
- targetProtocol
- upstreamKey
- realModelName
- requestIr
- clientRequestId
- timeoutMs
```

The adapter should not perform routing, permission checks, quota checks, or sticky-binding decisions.

## URL Construction

Adapters own URL construction.

Examples:

- Anthropic-compatible: `POST {baseUrl}/v1/messages`
- OpenAI-compatible: `POST {baseUrl}/v1/chat/completions`

Administrators should enter a base URL. The adapter appends the known endpoint path unless a future advanced setting explicitly allows full endpoint override.

## Authentication

Adapters own upstream authentication.

Examples:

- Anthropic-compatible: `x-api-key`.
- OpenAI-compatible: `Authorization: Bearer`.

Upstream API keys must never be logged or returned in API responses.

## Streaming

Adapters must convert provider stream events into the client-facing protocol requested by the caller.

MVP required conversions:

- Anthropic-compatible upstream to Anthropic client stream.
- Anthropic-compatible upstream to OpenAI client stream when OpenAI clients route to an Anthropic-compatible upstream.
- OpenAI-compatible upstream to OpenAI client stream.
- OpenAI-compatible upstream to Anthropic client stream when Anthropic clients route to an OpenAI-compatible upstream.

If a cross-protocol streaming conversion is not ready, the route should fail with a clear unsupported-route error instead of silently returning malformed streams.

## Usage Extraction

Adapters should extract:

- Input tokens.
- Output tokens.
- Total tokens.

If usage is unavailable:

- Store null usage fields.
- Still record request count, latency, status, selected upstream key, and real model.
- Do not guess token counts in MVP unless a tokenizer strategy is explicitly added later.

## Error Normalization

Adapters convert provider-specific failures into normalized errors.

Initial normalized categories:

```text
provider_authentication
provider_permission
provider_rate_limit
provider_quota
provider_timeout
provider_overloaded
provider_model_not_found
provider_bad_request
provider_stream_error
provider_unknown
```

Router behavior can then decide whether to retry, cool down, freeze, or return the error.

## Adding A New Provider

Checklist:

1. Add a provider type.
2. Implement adapter contract.
3. Declare capabilities.
4. Add admin dashboard preset labels and help text.
5. Add fake upstream tests.
6. Add non-stream gateway integration tests.
7. Add stream tests if streaming is supported.
8. Add usage extraction tests.
9. Add error normalization tests.
10. Document any unsupported capabilities.

Do not add provider-specific logic to the router core.
