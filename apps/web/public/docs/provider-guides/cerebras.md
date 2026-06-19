# Cerebras — How to get an API key

Use this guide to create a Cerebras API key for the **Cerebras** preset in ModelHarbor.

> Preset id: `cerebras` · Auth: PAT · Endpoint: `https://api.cerebras.ai`

## 1. Create or sign in to your account

1. Open the Cerebras console at <https://cloud.cerebras.ai>.
2. Sign in (Google, GitHub, or email).
3. Add a payment method under **Billing** if you need paid-tier quotas.

## 2. Create an API key

1. Go to <https://cloud.cerebras.ai/platform/api-keys>.
2. Click **Create API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Generate**.
4. Copy the key — it starts with `csk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Cerebras`.
3. **API key**: paste the `csk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 Unauthorized`**: key was rotated or copied with whitespace.
- **`429 Rate limit reached`**: lower request rate or upgrade the plan.
- **Model not listed**: Cerebras only exposes its in-house models; check the model catalog for availability.

## References

- Console: <https://cloud.cerebras.ai>
- API keys: <https://cloud.cerebras.ai/platform/api-keys>
- API docs: <https://inference-docs.cerebras.ai>