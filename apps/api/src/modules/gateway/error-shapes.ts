import type { NormalizedProviderError } from "../providers/types.js";

// Anthropic-style error body. The gateway returns this on /v1/messages for any
// non-2xx so the client SDK sees the same shape as a native Anthropic error.
export function anthropicErrorBody(
  err: NormalizedProviderError,
  fallbackMessage: string,
): { type: "error"; error: { type: string; message: string } } {
  return {
    type: "error",
    error: {
      type: mapCategoryToAnthropicType(err.category),
      message: err.providerMessage ?? fallbackMessage,
    },
  };
}

function mapCategoryToAnthropicType(category: NormalizedProviderError["category"]): string {
  switch (category) {
    case "provider_authentication":
      return "authentication_error";
    case "provider_permission":
      return "permission_error";
    case "provider_rate_limit":
      return "rate_limit_error";
    case "provider_quota":
      return "quota_error";
    case "provider_timeout":
      return "timeout_error";
    case "provider_overloaded":
      return "overloaded_error";
    case "provider_model_not_found":
      return "not_found_error";
    case "provider_bad_request":
      return "invalid_request_error";
    case "provider_stream_error":
      return "api_error";
    case "provider_unknown":
    default:
      return "api_error";
  }
}
