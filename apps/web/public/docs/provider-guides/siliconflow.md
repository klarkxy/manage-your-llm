# SiliconFlow — How to get an API key

Use this guide to create a SiliconFlow API key for the **SiliconFlow** preset in ModelHarbor.

> Preset id: `siliconflow` · Auth: PAT · Endpoint: `https://api.siliconflow.cn/v1`

## 1. Create or sign in to your account

1. Open the SiliconFlow console at <https://cloud.siliconflow.cn>.
2. Sign in with a Chinese phone number and complete verification.
3. Top up credits under **账户管理 → 充值**.

## 2. Create an API key

1. Go to <https://cloud.siliconflow.cn/account/ak>.
2. Click **新建 API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `SiliconFlow`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models** — SiliconFlow returns IDs like `vendor/model-name`. ModelHarbor strips the vendor prefix automatically.
5. Click **Create**.

## Troubleshooting

- **`401 invalid api key`**: re-copy from the console.
- **`429 rate limit`**: lower QPS or upgrade the plan.
- **`402 insufficient balance`**: top up credits.

## References

- Console: <https://cloud.siliconflow.cn>
- API keys: <https://cloud.siliconflow.cn/account/ak>
- API docs: <https://docs.siliconflow.cn>