# Baichuan — How to get an API key

Use this guide to create a Baichuan API key for the **Baichuan** preset in ModelHarbor.

> Preset id: `baichuan` · Auth: PAT · Endpoint: `https://api.baichuan-ai.com`

## 1. Create or sign in to your account

1. Open the Baichuan platform at <https://platform.baichuan-ai.com>.
2. Sign in with a Chinese phone number.
3. Top up credits under **账户管理 → 充值**.

## 2. Create an API key

1. Go to <https://platform.baichuan-ai.com/console/apikey>.
2. Click **新建 API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Baichuan`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 unauthorized`**: key was rotated; re-copy.
- **`402 insufficient balance`**: top up credits.
- **`429 rate limit`**: lower request rate.

## References

- Platform: <https://platform.baichuan-ai.com>
- API keys: <https://platform.baichuan-ai.com/console/apikey>