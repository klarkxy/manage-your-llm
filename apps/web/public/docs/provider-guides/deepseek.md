# DeepSeek — How to get an API key

Use this guide to create a DeepSeek API key for the **DeepSeek** preset in ModelHarbor.

> Preset id: `deepseek` · Auth: PAT · Endpoints:
> - Anthropic-compatible: `https://api.deepseek.com/anthropic`
> - OpenAI-compatible: `https://api.deepseek.com`

## 1. Create or sign in to your account

1. Open the DeepSeek platform at <https://platform.deepseek.com>.
2. Sign in (or register) and complete identity verification if prompted.
3. Top up your wallet under **Billing**. DeepSeek bills from prepaid credits.

## 2. Create an API key

1. Go to <https://platform.deepseek.com/api_keys>.
2. Click **Create new API key**.
3. Enter a name (e.g. `modelharbor`) and click **Create**.
4. Copy the key (it starts with `sk-...`). **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `DeepSeek`. The preset exposes two endpoints — Anthropic-compatible (`/anthropic`) and OpenAI-compatible. ModelHarbor picks the OpenAI-compatible endpoint by default; you can switch it manually if your client uses Anthropic Messages.
3. **API key**: paste the `sk-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`402 Payment Required`**: wallet balance is empty — top up credits.
- **`401 Authentication Fails`**: key copied with extra whitespace or wrong endpoint selected.
- **`429 Rate Limit Reached`**: throttle your request rate or contact DeepSeek support for higher limits.

## References

- Platform: <https://platform.deepseek.com>
- API keys: <https://platform.deepseek.com/api_keys>
- API docs: <https://api-docs.deepseek.com>