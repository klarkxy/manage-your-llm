# Baidu Qianfan — How to get an API key

Use this guide to create a Baidu Qianfan API key for the **Baidu Qianfan** preset in ModelHarbor.

> Preset id: `qianfan` · Auth: PAT · Endpoint: `https://qianfan.baidubce.com` (path: `/v2/chat/completions`)

## 1. Create or sign in to your account

1. Open Baidu Qianfan at <https://qianfan.baidubce.com>.
2. Sign in with a Baidu account and complete real-name verification.
3. Activate the **千帆大模型平台** service and bind a payment method.

## 2. Create an API key

1. Go to <https://console.bce.baidu.com/iam/#/iam/accesslist>.
2. Click **创建 Access Key**.
3. Copy the `Access Key ID` (AK) and `Secret Access Key` (SK). **The SK is shown only once.**

## 3. Fill in ModelHarbor

The Qianfan preset accepts the **Access Key** as the API key. The Bearer token expected by `/v2/chat/completions` is generated internally.

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Baidu Qianfan`.
3. **API key**: paste the AK value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 invalid_access_key`**: the AK was rotated; re-copy from the IAM console.
- **`403 permission denied`**: enable Qianfan permissions on the IAM user.
- **`429 rate limit`**: lower QPS or upgrade the Qianfan quota.

## References

- Qianfan: <https://qianfan.baidubce.com>
- Access Key: <https://console.bce.baidu.com/iam/#/iam/accesslist>
- API docs: <https://cloud.baidu.com/doc/qianfan>