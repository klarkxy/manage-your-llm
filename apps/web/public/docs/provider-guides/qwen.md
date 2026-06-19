# Alibaba Qwen (DashScope, China) — How to get an API key

Use this guide to create a DashScope (China) API key for the **Alibaba Qwen (DashScope China)** preset in ModelHarbor.

> Preset id: `qwen` · Auth: PAT · Endpoint: `https://dashscope.aliyuncs.com/compatible-mode`

## 1. Create or sign in to your account

1. Open the DashScope (China) console at <https://dashscope.console.aliyun.com>.
2. Sign in with your Alibaba Cloud account (Aliyun).
3. Activate the **Model Studio** service if prompted, and bind a payment method under **费用管理**.

## 2. Create an API key

1. Go to <https://dashscope.console.aliyun.com/apiKey>.
2. Click **创建 API-KEY**.
3. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Alibaba Qwen (DashScope China)`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`Invalid API key`**: key was rotated; re-copy from the console.
- **`Quota exhausted`**: top up the Model Studio quota.
- **Cross-region mismatch**: do not mix `dashscope.aliyuncs.com` (China) with `dashscope-intl.aliyuncs.com` (international).

## References

- Console (China): <https://dashscope.console.aliyun.com>
- API keys: <https://dashscope.console.aliyun.com/apiKey>
- Docs: <https://help.aliyun.com/zh/model-studio>