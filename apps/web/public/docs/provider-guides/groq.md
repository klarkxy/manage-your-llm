# Groq — How to get an API key

Use this guide to create a Groq API key for the **Groq** preset in ModelHarbor.

> Preset id: `groq` · Auth: PAT · Endpoint: `https://api.groq.com/openai`

## 1. Create or sign in to your account

1. Open the Groq console at <https://console.groq.com>.
2. Sign in (or register). Groq has a generous free tier; paid plans raise the rate limits.

## 2. Create an API key

1. Go to <https://console.groq.com/keys>.
2. Click **Create API Key**.
3. Enter a name (e.g. `modelharbor`) and click **Submit**.
4. Copy the key — it starts with `gsk_...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Groq`.
3. **API key**: paste the `gsk_...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 invalid api key`**: the key was rotated; re-copy.
- **`429 rate limit reached`**: lower request rate or upgrade the plan.
- **Model not in fetch results**: Groq exposes a curated set; only those models are listed.

## References

- Console: <https://console.groq.com>
- API keys: <https://console.groq.com/keys>
- API docs: <https://console.groq.com/docs>