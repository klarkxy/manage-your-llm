# ByteDance Volcano Ark — How to get an API key

Use this guide to create a Volcano Ark API key for the **ByteDance Volcano Ark** preset in ModelHarbor.

> Preset id: `bytedance` · Auth: PAT · Endpoint: `https://ark.cn-beijing.volces.com/api` (path: `/v3/chat/completions`)

## 1. Create or sign in to your account

1. Open Volcano Engine at <https://www.volcengine.com>.
2. Sign in and complete real-name verification.
3. Activate the **Ark (大模型推理)** service under **产品管理**.

## 2. Create an inference endpoint + API key

Ark uses **online inference endpoints** instead of raw model names. Each endpoint has its own API key.

1. Go to <https://www.volcengine.com/product/ark>.
2. Open **在线推理 → 我的端点**.
3. Click **创建端点** and pick a model (e.g. `doubao-pro-32k`, `deepseek-r1`).
4. Once the endpoint is running, click **开通/管理** → **API Key 管理**.
5. Click **创建 API Key**, pick a name (e.g. `modelharbor`), and copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `ByteDance Volcano Ark`.
3. **API key**: paste the `sk-...` value.
4. Model mappings: type the **endpoint ID** (e.g. `ep-20250510xxxxx-xxxxx`) as the **Real model name**. The endpoint ID is shown next to each endpoint on the Ark page.
5. Click **Create**.

## Troubleshooting

- **`401 invalid api key`**: re-copy from the API Key 管理 page.
- **`404 model not found`**: the endpoint ID was mistyped; copy from the Ark console.
- **`429 rate limit`**: lower QPS or upgrade the TPS quota on the endpoint.

## References

- Volcano Ark: <https://www.volcengine.com/product/ark>
- Ark docs: <https://www.volcengine.com/docs/82379>