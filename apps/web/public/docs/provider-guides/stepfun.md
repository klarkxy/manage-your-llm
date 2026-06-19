# StepFun — How to get an API key

Use this guide to create a StepFun API key for the **StepFun** preset in ModelHarbor.

> Preset id: `stepfun` · Auth: PAT · Endpoint: `https://api.stepfun.com`

## 1. Create or sign in to your account

1. Open the StepFun platform at <https://platform.stepfun.com>.
2. Sign in with a Chinese phone number.
3. Top up credits under **账户管理**.

## 2. Create an API key

1. Go to <https://platform.stepfun.com/interface>.
2. Click **创建 API Key**.
3. Enter a name (e.g. `modelharbor`) and click **确定**.
4. Copy the key — it starts with `step-...`. **It is shown only once.**

## 3. Fill in ModelHarbor

1. Open **Upstream Keys → New upstream key**.
2. **Provider preset**: `StepFun`.
3. **API key**: paste the `step-...` value.
4. Click **Fetch models**, then **Create**.

## Troubleshooting

- **`401 unauthorized`**: re-copy the key.
- **`402 insufficient balance`**: top up credits.
- **`429 rate limit`**: lower QPS or upgrade the plan.

## References

- Platform: <https://platform.stepfun.com>
- API keys: <https://platform.stepfun.com/interface>