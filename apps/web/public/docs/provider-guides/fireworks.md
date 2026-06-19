# Fireworks AI — How to get an API key

Use this guide to create a Fireworks AI API key for the **Fireworks AI** preset in ModelHarbor.

> Preset id: `fireworks` · Auth: PAT · Endpoint: `https://api.fireworks.ai/inference`

## 1. Create or sign in to your account

1. Open the Fireworks dashboard at <https://fireworks.ai>.
2. Sign in (Google, GitHub, or email).
3. Add a payment method under **Billing**.

## 2. Create an API key

1. Go to <https://fireworks.ai/account/api-keys>.
2. Click **Create API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `fw_...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Fireworks AI`.
3. **API key**: paste the `fw_...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 Unauthorized`**: re-copy the key from the dashboard.
- **`402 Payment required`**: add a payment method.
- **`429 Rate limit`**: lower QPS or upgrade the plan.

## References

- Dashboard: <https://fireworks.ai>
- API keys: <https://fireworks.ai/account/api-keys>
- API docs: <https://docs.fireworks.ai>