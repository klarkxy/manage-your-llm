# Zhipu GLM Coding Plan — How to get an API key

Use this guide to create a Zhipu GLM Coding Plan API key for the **Zhipu GLM Coding Plan** preset in ModelHarbor.

> Preset id: `zhipu-coding` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://open.bigmodel.cn/api/anthropic`
> - OpenAI-compatible (coding): `https://open.bigmodel.cn/api/coding/paas` (path: `/v4/chat/completions`)

## 1. Subscribe to the Coding Plan

1. Open <https://bigmodel.cn> and sign in.
2. Subscribe to **GLM Coding Plan** under **套餐 / Coding Plan**. The plan unlocks `coding/glm-4.6` and friends.
3. Complete real-name verification and add a payment method if required.

## 2. Create an API key

1. Go to <https://bigmodel.cn/usercenter/apikeys>.
2. Click **添加新的 API Key**.
3. Enter a name (e.g. `modelharbor-coding`) and click **Create**.
4. Copy the key — it starts with `glm-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Zhipu GLM Coding Plan**. The preset picks the coding endpoint (`/api/coding/paas`).
3. **API key**: paste the `glm-...` value.
4. Click **Fetch models** — only `coding/*` models are listed.
5. Click **Create**.

## Troubleshooting

- **`401 authentication failed`**: key was rotated; re-copy.
- **`1301 token invalid`**: the key expired or was revoked; regenerate.
- **`Quota exceeded`**: upgrade the Coding Plan tier.

## References

- Console: <https://bigmodel.cn>
- API keys: <https://bigmodel.cn/usercenter/apikeys>
- Coding plan docs: <https://docs.bigmodel.cn/coding-plan/overview>