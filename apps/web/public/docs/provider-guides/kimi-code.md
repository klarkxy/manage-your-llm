# Kimi Code — How to get an API key

Use this guide to create a Kimi Coding API key for the **Kimi Code** preset in ModelHarbor.

> Preset id: `kimi-code` · Auth: PAT · Endpoint: `https://api.kimi.com/coding`

## 1. Subscribe to the Coding plan

1. Open <https://kimi.moonshot.cn> and sign in (Chinese phone number).
2. Subscribe to **Kimi Coding 会员** under **会员中心**. The Coding endpoint requires an active Coding plan.
3. Complete real-name verification and add a payment method.

## 2. Create an API key

1. Go to <https://kimi.moonshot.cn/user-center/coding-api-keys>.
2. Click **新建 Coding API Key**.
3. Enter a name (e.g. `modelharbor`) and click **确定**.
4. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Kimi Code`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models** — the Coding endpoint only exposes `kimi-k2-*` and related coding models.
5. Click **Create**.

## Troubleshooting

- **`401 unauthorized`**: key was rotated; re-copy.
- **`403 coding plan expired`**: renew the Coding membership.
- **`429 rate limit`**: lower QPS or upgrade the Coding tier.

## References

- Kimi: <https://kimi.moonshot.cn>
- Coding API keys: <https://kimi.moonshot.cn/user-center/coding-api-keys>