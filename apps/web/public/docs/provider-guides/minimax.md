# MiniMax (China) — How to get an API key

Use this guide to create a MiniMax API key for the **MiniMax (China)** preset in ModelHarbor.

> Preset id: `minimax` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://api.minimaxi.com/anthropic`
> - OpenAI-compatible: `https://api.minimaxi.com`

## 1. Create or sign in to your account

1. Open the MiniMax open platform at <https://platform.minimaxi.com>.
2. Sign in (or register). Mainland China accounts require a Chinese phone number.
3. Top up credits under **账户管理 → 充值**. MiniMax bills from prepaid credits.

## 2. Create an API key

1. Go to <https://platform.minimaxi.com/user-center/apikeys>.
2. Click **新建 API Key**.
3. Pick a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `eyJ...` (a JWT) or with `sk-...` depending on the plan. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `MiniMax (China)`.
3. **API key**: paste the key.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`1004 authentication failed`**: key was rotated; re-copy from the dashboard.
- **`1008 insufficient balance`**: top up credits.
- **`1013 rate limit exceeded`**: lower request rate or upgrade your plan.
- **Cross-region mismatch**: do not mix `minimaxi.com` (China) with `minimax.io` (international) keys.

## References

- Platform: <https://platform.minimaxi.com>
- API keys: <https://platform.minimaxi.com/user-center/apikeys>
- API docs: <https://platform.minimaxi.com/document>