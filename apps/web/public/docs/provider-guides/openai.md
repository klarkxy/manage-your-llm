# OpenAI — How to get an API key

Use this guide to create an OpenAI API key for the **OpenAI** preset in ModelHarbor.

> Preset id: `openai` · Auth: Personal Access Token (PAT) · Endpoint: `https://api.openai.com`

## 1. Create or sign in to your account

1. Open the OpenAI dashboard at <https://platform.openai.com>.
2. Sign in (or create a developer account).
3. Add a payment method under **Settings → Billing**. The OpenAI API is paid-as-you-go; without a valid payment method every request returns `429 insufficient_quota`.

## 2. Create an API key

1. Go to <https://platform.openai.com/api-keys>.
2. Click **Create new secret key**.
3. Pick a name (e.g. `modelharbor`) and an optional project.
4. Copy the key — it starts with `sk-...`. **OpenAI only shows the full key once.** Save it somewhere safe before closing the dialog.

## 3. (Optional) Restrict the key

Under **Permissions** you can scope the key to specific models or to read-only mode. Restricting the key is recommended for production deployments.

## 4. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `OpenAI`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models** to populate the model list, then **Create**.

## Troubleshooting

- **`401 Unauthorized`**: the key was rotated, deleted, or pasted with extra whitespace. Re-copy it from the dashboard.
- **`429 insufficient_quota`**: add a payment method or top up credits under **Billing**.
- **`429 rate_limit_exceeded`**: lower QPS on ModelHarbor, or request a higher tier from OpenAI.
- **Model not listed after Fetch models**: ensure the account has access to the model (some models require a waitlist or a separate organization invite).

## References

- OpenAI API keys: <https://platform.openai.com/api-keys>
- OpenAI billing: <https://platform.openai.com/account/billing>
- OpenAI usage tiers: <https://platform.openai.com/docs/guides/rate-limits>