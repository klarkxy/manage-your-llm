# 客户端配置指南

ManageYourLLM 对外提供 OpenAI 兼容的 `/v1` 网关入口，同时也支持 Anthropic Messages 协议。下游客户端只需要配置三项：

- **Base URL**：管理台 Settings 中 `publicBaseUrl + gatewayBasePath` 的组合，例如 `https://llm.example.com/v1`。
- **API Key**：在 Apps 页面创建的 Consumer Key。
- **Model**：Public Model 名或 Model Group 名。

> 管理台 **Apps** 页面和 **Setup Wizard** 完成页提供一键生成配置片段的功能，建议优先使用。

## 通用 OpenAI 兼容客户端

片段示例：

```bash
curl -X POST https://llm.example.com/v1/chat/completions \
  -H "Authorization: Bearer <your-consumer-key>" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-5", "messages": [{"role": "user", "content": "Hello"}]}'
```

Python `openai` 客户端：

```python
import openai
client = openai.OpenAI(base_url="https://llm.example.com/v1", api_key="<your-consumer-key>")
response = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Claude Code

Claude Code 使用 Anthropic 协议，ManageYourLLM 网关的 `/messages` 端点兼容该协议。

设置环境变量后启动：

```bash
export ANTHROPIC_BASE_URL="https://llm.example.com/v1"
export ANTHROPIC_API_KEY="<your-consumer-key>"
claude-code --model "<public-model-name>"
```

## Codex CLI

Codex CLI 基于 OpenAI 协议：

```bash
export OPENAI_BASE_URL="https://llm.example.com/v1"
export OPENAI_API_KEY="<your-consumer-key>"
codex --model "<public-model-name>"
```

## OpenCode / Continue

在 IDE 插件中添加自定义 provider：

- Base URL：`https://llm.example.com/v1`
- API Key：`<your-consumer-key>`
- Model：`<public-model-name>`

## Hermes

在 Hermes 配置中设置：

```toml
base_url = "https://llm.example.com/v1"
api_key = "<your-consumer-key>"
model = "<public-model-name>"
```

## Cherry Studio

1. 打开 Cherry Studio 的模型提供商设置。
2. 添加自定义 provider：
   - Provider Name：`ManageYourLLM`
   - Base URL：`https://llm.example.com/v1`
   - API Key：`<your-consumer-key>`
   - Model Name：`<public-model-name>`

## 注意事项

- Consumer Key 创建后只在弹窗中显示一次，请立即保存。
- 若使用 restricted access mode，Consumer Key 只能访问被授予的 Public Model 或 Model Group。
- 若 model 是 Model Group，网关会按组内策略选择具体 Public Model。
- 临时需要更换 key 时，可在 Apps 页面点击 **Rotate（轮换）**，新 key 同样只显示一次。
