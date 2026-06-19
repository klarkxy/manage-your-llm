# MiniMax (International) — How to get an API key

Use this guide to create a MiniMax API key for the **MiniMax (International)** preset in ModelHarbor.

> Preset id: `minimax-intl` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://api.minimax.io/anthropic`
> - OpenAI-compatible: `https://api.minimax.io`

## 1. Create or sign in to your account

1. Open the international platform at <https://platform.minimax.io>.
2. Sign in (or register). International accounts use overseas billing.
3. Top up credits under **Billing**.

## 2. Create an API key

1. Go to <https://platform.minimax.io/user-center/apikeys>.
2. Click **Create API Key**.
3. Pick a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key — it starts with `eyJ...` or `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `MiniMax (International)`.
3. **API key**: paste the key.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`authentication failed`**: key was revoked; re-copy.
- **`insufficient balance`**: top up credits.
- **Region mismatch**: do not mix `minimax.io` (international) with `minimaxi.com` (China) keys.

## References

- Platform (international): <https://platform.minimax.io>
- API keys: <https://platform.minimax.io/user-center/apikeys>