# Moonshot (Kimi) International — How to get an API key

Use this guide to create a Moonshot international API key for the **Moonshot (Kimi) (International)** preset in ModelHarbor.

> Preset id: `moonshot` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://api.moonshot.ai/anthropic`
> - OpenAI-compatible: `https://api.moonshot.ai`

## 1. Create or sign in to your account

1. Open the international platform at <https://platform.moonshot.ai>.
2. Sign in (or register). International accounts use overseas billing.
3. Top up your wallet under **Billing** — pay-as-you-go credits.

## 2. Create an API key

1. Go to <https://platform.moonshot.ai/user-center/api-keys>.
2. Click **Create API key**.
3. Enter a name (e.g. `modelharbor`) and click **Confirm**.
4. Copy the key (it starts with `sk-...`). It is shown only once.

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `Moonshot (Kimi) (International)`.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 invalid api key`**: re-copy the key; the dashboard lets you regenerate.
- **`403 quota exceeded`**: top up credits or wait for the next billing cycle.
- **Chinese-only platform**: switch to the China preset (`moonshot-cn`) if you have a `platform.moonshot.cn` account.

## References

- Platform (international): <https://platform.moonshot.ai>
- API keys: <https://platform.moonshot.ai/user-center/api-keys>
- Kimi docs: <https://platform.moonshot.ai/docs>