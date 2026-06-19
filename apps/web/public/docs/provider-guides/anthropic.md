# Anthropic — How to get an API key

Use this guide to create an Anthropic API key for the **Anthropic** preset in ModelHarbor.

> Preset id: `anthropic` · Auth: PAT (`x-api-key` header) · Endpoint: `https://api.anthropic.com`

## 1. Create or sign in to your account

1. Open the Anthropic console at <https://console.anthropic.com>.
2. Sign in (or create a developer account).
3. Add a credit balance or purchase the Build plan. The Anthropic API requires prepaid credits for new accounts.

## 2. Create an API key

1. Go to <https://console.anthropic.com/settings/keys>.
2. Click **Create Key**.
3. Enter a name (e.g. `modelharbor`) and an optional workspace.
4. Copy the key — it starts with `sk-ant-...`. **Anthropic only shows the full key once.** Store it in your secret manager.

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Anthropic`.
3. **API key**: paste the `sk-ant-...` value.
4. Click **Fetch models** and then **Create**.

The adapter sends the key as the `x-api-key` header and adds `anthropic-version: 2023-06-01`. No additional configuration is required.

## Troubleshooting

- **`401 AuthenticationError`**: key was revoked or pasted with stray line breaks.
- **`403 permission_error`**: the requesting account does not have access to the requested model.
- **`404 not_found_error`**: the model name is misspelled or unavailable in your region.
- **`429 rate_limit_error`**: lower concurrency or contact Anthropic sales to raise the tier.

## References

- Console: <https://console.anthropic.com>
- API keys: <https://console.anthropic.com/settings/keys>
- Models overview: <https://docs.anthropic.com/en/docs/about-claude/models/overview>