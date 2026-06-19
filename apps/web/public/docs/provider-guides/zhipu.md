# Zhipu GLM — How to get an API key

Use this guide to create a Zhipu API key for the **Zhipu GLM** preset in ModelHarbor.

> Preset id: `zhipu` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://open.bigmodel.cn/api/anthropic`
> - OpenAI-compatible: `https://open.bigmodel.cn/api/paas` (path: `/v4/chat/completions`)

## 1. Create or sign in to your account

1. Open the Zhipu BigModel console at <https://bigmodel.cn>.
2. Sign in with a mainland-China phone number and complete real-name verification.
3. Top up credits under **账户管理 → 充值**.

## 2. Create an API key

1. Go to <https://bigmodel.cn/usercenter/apikeys>.
2. Click **添加新的 API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `glm-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Zhipu GLM`.
3. **API key**: paste the `glm-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 authentication failed`**: key was rotated; re-copy from the console.
- **`402 insufficient balance`**: top up credits.
- **`1301 token invalid`**: the key may have expired; regenerate it.
- **Region mismatch**: do not use `bigmodel.cn` keys against overseas endpoints.

## References

- Console: <https://bigmodel.cn>
- API keys: <https://bigmodel.cn/usercenter/apikeys>
- API docs: <https://docs.bigmodel.cn>