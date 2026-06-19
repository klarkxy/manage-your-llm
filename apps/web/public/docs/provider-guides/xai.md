# xAI (Grok) — How to get an API key

Use this guide to create an xAI API key for the **xAI (Grok)** preset in ModelHarbor.

> Preset id: `xai` · Auth: PAT · Endpoint: `https://api.x.ai`

## 1. Create or sign in to your account

1. Open the xAI console at <https://console.x.ai>.
2. Sign in (Google, Apple, or email).
3. Add credits or a payment method under **Billing**.

## 2. Create an API key

1. Go to <https://console.x.ai/team/api-keys>.
2. Click **Create API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Save**.
4. Copy the key — it starts with `xai-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `xAI (Grok)`.
3. **API key**: paste the `xai-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 incorrect api key`**: re-copy the key from the dashboard.
- **`402 insufficient credit balance`**: top up credits under Billing.
- **`429 too many requests`**: lower QPS or upgrade to a higher tier.

## References

- Console: <https://console.x.ai>
- API keys: <https://console.x.ai/team/api-keys>
- API docs: <https://docs.x.ai>