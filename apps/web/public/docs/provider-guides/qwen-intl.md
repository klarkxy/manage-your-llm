# Alibaba Qwen (DashScope, International) — How to get an API key

Use this guide to create a DashScope (International) API key for the **Alibaba Qwen (DashScope International)** preset in ModelHarbor.

> Preset id: `qwen-intl` · Auth: PAT · Endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode`

## 1. Create or sign in to your account

1. Open the DashScope (International) console at <https://dashscope-intl.console.aliyun.com>.
2. Sign in with an international Alibaba Cloud account.
3. Activate **Model Studio** and add a payment method.

## 2. Create an API key

1. Go to <https://dashscope-intl.console.aliyun.com/apiKey>.
2. Click **Create API-KEY**.
3. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Alibaba Qwen (DashScope International)`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`Invalid API key`**: re-copy from the console.
- **`Quota exhausted`**: top up Model Studio credits.
- **Cross-region mismatch**: do not mix `dashscope-intl.aliyuncs.com` (international) with `dashscope.aliyuncs.com` (China).

## References

- Console (international): <https://dashscope-intl.console.aliyun.com>
- API keys: <https://dashscope-intl.console.aliyun.com/apiKey>