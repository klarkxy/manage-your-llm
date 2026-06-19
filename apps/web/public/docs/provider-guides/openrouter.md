# OpenRouter — How to get an API key

Use this guide to create an OpenRouter API key for the **OpenRouter** preset in ModelHarbor.

> Preset id: `openrouter` · Auth: PAT · Endpoint: `https://openrouter.ai/api`

## 1. Create or sign in to your account

1. Open OpenRouter at <https://openrouter.ai>.
2. Sign in (Google, GitHub, MetaMask, or email).
3. Add credits under **Credits**. OpenRouter bills prepaid.

## 2. Create an API key

1. Go to <https://openrouter.ai/settings/keys>.
2. Click **Create Key**.
3. Enter a name (e.g. `modelharbor`) and an optional credit limit.
4. Copy the key — it starts with `sk-or-v1-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `OpenRouter`.
3. **API key**: paste the `sk-or-v1-...` value.
4. Click **Fetch models** — OpenRouter returns hundreds of upstream models, so only pick the ones you intend to route.
5. Click **Create**.

## (Optional) Recommended headers

OpenRouter recommends sending these extra headers for better attribution and ranking in the leaderboard:

| Header | Example value |
| --- | --- |
| `HTTP-Referer` | `https://your-app.example.com` |
| `X-Title` | `ModelHarbor` |

Set them under **Extra headers** in the drawer.

## Troubleshooting

- **`401 No auth credentials`**: the key was pasted with extra whitespace.
- **`402 Insufficient credits`**: top up at <https://openrouter.ai/credits>.
- **`429 Rate limit`**: throttle request rate or upgrade the credit limit on the key.

## References

- OpenRouter keys: <https://openrouter.ai/settings/keys>
- API reference: <https://openrouter.ai/docs>
- Pricing: <https://openrouter.ai/models>