# OpenCode Zen — How to get an API key

Use this guide to create an OpenCode Zen API key for the **OpenCode Zen** preset in ModelHarbor.

> Preset id: `opencode-zen` · Auth: PAT · Endpoint: `https://opencode.ai/zen/v1`

## 1. Create or sign in to your account

1. Open OpenCode Zen at <https://opencode.ai>.
2. Sign in with GitHub.
3. Subscribe to the **Zen** plan under **Billing**.

## 2. Create an API key

1. Go to <https://opencode.ai/zen>.
2. Click **Create API Key**.
3. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `OpenCode Zen`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 unauthorized`**: the key was revoked.
- **`402 payment required`**: Zen plan subscription has lapsed.
- **`429 rate limit`**: throttle request rate or upgrade to a higher tier.

## References

- OpenCode Zen: <https://opencode.ai>
- Zen plan: <https://opencode.ai/zen>