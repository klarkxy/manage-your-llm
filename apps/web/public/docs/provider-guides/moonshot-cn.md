# Moonshot (Kimi) China — How to get an API key

Use this guide to create a Moonshot API key for the **Moonshot (Kimi) (China)** preset in ModelHarbor.

> Preset id: `moonshot-cn` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://api.moonshot.cn/anthropic`
> - OpenAI-compatible: `https://api.moonshot.cn`

## 1. Create or sign in to your account

1. Open the China platform at <https://platform.moonshot.cn>.
2. Register with a mainland-China phone number and complete real-name verification.
3. Top up credits under **账户中心 → 充值**.

## 2. Create an API key

1. Go to <https://platform.moonshot.cn/user-center/api-keys>.
2. Click **新建 API Key**.
3. Enter a name (e.g. `modelharbor`) and click **确定**.
4. Copy the key (it starts with `sk-...`). It is shown only once.

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Moonshot (Kimi) (China)`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 invalid api key`**: key was rotated or copied with stray whitespace.
- **`403 余额不足`**: wallet balance empty — top up under **充值**.
- **Cross-border issue**: do not mix the `.cn` and `.ai` endpoints; pick the preset that matches your account region.

## References

- Platform (China): <https://platform.moonshot.cn>
- API keys: <https://platform.moonshot.cn/user-center/api-keys>