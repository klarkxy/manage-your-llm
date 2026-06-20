# OpenCode Go — How to get an API key

Use this guide to create an OpenCode Go API key for the **OpenCode Go** preset in ModelHarbor.

> Preset id: `opencode-go` · Auth: PAT · Endpoints: `https://opencode.ai/zen/go/v1/chat/completions` and `https://opencode.ai/zen/go/v1/messages`

## 1. Create or sign in to your account

1. Open OpenCode Zen at <https://opencode.ai>.
2. Sign in with GitHub.
3. Subscribe to the **Go** plan under **Billing**.

## 2. Create an API key

1. Go to <https://opencode.ai/zen/go>.
2. Click **Create API Key**.
3. Copy the key — it starts with `sk-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `OpenCode Go`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

ModelHarbor uses the official OpenCode Go model table to choose the upstream API:

- GLM, Kimi, DeepSeek, and MiMo models use the OpenAI-compatible chat completions endpoint.
- MiniMax and Qwen models use the Anthropic-compatible messages endpoint.

## Troubleshooting

- **`401 unauthorized`**: the key was revoked.
- **`402 payment required`**: Go plan subscription has lapsed.
- **Model not listed**: the Go plan only includes a curated subset; upgrade to Zen for the full catalogue.

## References

- OpenCode Zen: <https://opencode.ai>
- Go plan: <https://opencode.ai/zen/go>
- OpenCode Go docs: <https://opencode.ai/docs/zh-cn/go>
