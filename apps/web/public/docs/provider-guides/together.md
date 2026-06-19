# Together AI — How to get an API key

Use this guide to create a Together AI API key for the **Together AI** preset in ModelHarbor.

> Preset id: `together` · Auth: PAT · Endpoint: `https://api.together.xyz`

## 1. Create or sign in to your account

1. Open the Together dashboard at <https://api.together.xyz>.
2. Sign in (Google, GitHub, or email).
3. Add a payment method under **Billing**.

## 2. Create an API key

1. Go to <https://api.together.xyz/settings/api-keys>.
2. Click **Create API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `tg-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Together AI`.
3. **API key**: paste the `tg-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 Invalid API key`**: re-copy the key; the dashboard lets you regenerate.
- **`429 Rate limit`**: lower request rate or upgrade your credit.
- **`402 Payment required`**: add a payment method under Billing.

## References

- Dashboard: <https://api.together.xyz>
- API keys: <https://api.together.xyz/settings/api-keys>
- API docs: <https://docs.together.ai>