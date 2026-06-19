# Tencent Hunyuan — How to get an API key

Use this guide to create a Tencent Hunyuan API key for the **Tencent Hunyuan** preset in ModelHarbor.

> Preset id: `hunyuan` · Auth: PAT · Endpoint: `https://api.hunyuan.cloud.tencent.com`

## 1. Create or sign in to your account

1. Open Tencent Cloud at <https://console.cloud.tencent.com>.
2. Sign in and complete real-name verification.
3. Activate the **Hunyuan (混元大模型)** service under **产品** → **AI 智能体**.

## 2. Create an API key

1. Go to <https://console.cloud.tencent.com/hunyuan/api-key>.
2. Click **新建密钥**.
3. Pick a name (e.g. `modelharbor`) and click **确定**.
4. Copy the `SecretId` and `SecretKey` pair. **The SecretKey is shown only once.**

## 3. Fill in ModelHarbor

Tencent Hunyuan's API expects `Authorization: TC3-HMAC-SHA256 ...`. The Hunyuan adapter accepts the `SecretId` as the API key, but the **SecretKey** must be supplied separately.

**Workaround (PAT mode)**: pass `SecretId` as `apiKey` and leave authentication mode = PAT for now. Tencent's Hunyuan endpoint does accept SecretId-only requests for `hunyuan-turbo` in beta; for full signing, use the Tencent SDK outside ModelHarbor.

If you hit `401 Signature`, generate a new access token through Tencent Cloud's API explorer and paste the resulting access token into ModelHarbor instead.

## Troubleshooting

- **`401 Signature`**: rotate the SecretId/SecretKey pair.
- **`403 UnauthorizedOperation`**: Hunyuan service is not activated on the account.
- **`429 rate limit`**: lower QPS or upgrade the concurrency quota.

## References

- Tencent Hunyuan: <https://cloud.tencent.com/product/hunyuan>
- API keys: <https://console.cloud.tencent.com/hunyuan/api-key>
- API docs: <https://cloud.tencent.com/document/api/1729>