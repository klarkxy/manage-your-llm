# Agnes AI — How to get an API key

Use this guide to create an Agnes AI API key for the **Agnes AI** preset in ModelHarbor.

> Preset id: `agnes-ai` · Auth: PAT · Endpoint: `https://apihub.agnes-ai.com/v1`

## 1. Create or sign in to your account

1. Open the Agnes AI hub at <https://agnes-ai.com>.
2. Sign in (or register).
3. Activate an API plan under **Billing**.

## 2. Create an API key

1. Open the API hub at <https://apihub.agnes-ai.com>.
2. Go to **Account → API Keys**.
3. Click **Create API Key**.
4. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Agnes AI`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 Unauthorized`**: re-copy the key.
- **`402 Payment required`**: activate a paid plan.
- **`429 Rate limit`**: lower QPS or upgrade the plan.

## References

- Agnes AI: <https://agnes-ai.com>
- API hub: <https://apihub.agnes-ai.com>