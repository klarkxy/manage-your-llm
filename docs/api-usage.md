# API 使用指南

本指南面向需要调用 ModelHarbor 网关的下游开发者。管理员也可以参考此文档为下游团队提供接入说明。

---

## 支持的协议与端点

| 协议 | 端点 | 说明 |
| --- | --- | --- |
| OpenAI Chat Completions | `POST /v1/chat/completions` | 兼容 OpenAI 格式 |
| Anthropic Messages | `POST /v1/messages` | 兼容 Anthropic 格式 |
| OpenAI Responses | `POST /v1/responses` | 兼容 OpenAI Responses 格式 |
| 模型列表 | `GET /v1/models` | 返回当前 Consumer Key 可访问的模型和模型组 |

生成类端点支持流式（`stream: true`）和非流式；`GET /v1/models` 仅返回模型列表。

---

## 认证

调用网关需要一个 Consumer Key。推荐方式：

```bash
Authorization: Bearer mh_your_consumer_key
```

如果使用 Anthropic 客户端，也支持：

```bash
x-api-key: mh_your_consumer_key
```

两个 header 同时存在时，`Authorization` 优先。

---

## 模型名

请求中的 `model` 字段应填写 ModelHarbor 中定义的**公共模型名**或**模型组名**，而不是上游供应商的真实模型名。例如：

```json
{ "model": "gpt-4o" }
```

或：

```json
{ "model": "coder" }
```

可用模型列表可通过 `GET /v1/models` 查询。

---

## 请求示例

### OpenAI Chat Completions

```bash
curl http://localhost:5420/v1/chat/completions \
  -H "Authorization: Bearer mh_your_consumer_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

流式：

```bash
curl http://localhost:5420/v1/chat/completions \
  -H "Authorization: Bearer mh_your_consumer_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### Anthropic Messages

```bash
curl http://localhost:5420/v1/messages \
  -H "x-api-key: mh_your_consumer_key" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-sonnet",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### OpenAI Responses

```bash
curl http://localhost:5420/v1/responses \
  -H "Authorization: Bearer mh_your_consumer_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "responses-model",
    "input": "Write a Python function to sort a list."
  }'
```

---

## 获取模型列表

```bash
curl http://localhost:5420/v1/models \
  -H "Authorization: Bearer mh_your_consumer_key"
```

返回当前 Consumer Key 有权访问的所有公共模型和模型组。目标类型位于 `metadata.target_type`，例如 `public_model` 或 `model_group`。

---

## 路由行为对客户端的影响

- **故障转移**：如果首选上游失败，ModelHarbor 会自动尝试下一个候选。客户端通常无感知，但可能观察到稍高的首次 token 延迟。
- **粘性**：同一会话可能复用之前的上游模型，以提高缓存命中率。无需客户端传递额外 header。
- **跨协议**：非流式请求支持跨协议转换；流式请求不支持跨协议，会返回校验错误。

---

## 常见错误码

| 状态码 | 含义 | 客户端应如何处理 |
| --- | --- | --- |
| `401` | Consumer Key 无效或已撤销 | 检查 key 是否正确、是否已过期/被撤销。 |
| `403` | Consumer Key 无权访问该模型 | 联系管理员授权该模型或模型组。 |
| `404` | 模型名不存在 | 检查 `model` 字段是否为有效的公共模型或模型组名。 |
| `429` | 所有候选暂时不可用（限流/冷却/配额） | 稍后重试，或联系管理员检查上游状态。 |
| `502` | 上游返回错误 | 查看响应中的错误信息，必要时联系管理员。 |
| `503` | 没有可用路由 | 所有候选都被禁用、冻结或熔断，联系管理员。 |

客户端不应向上游透传任何 ModelHarbor 内部状态码之外的实现细节。

---

## 获取 Trace ID

每次请求的响应头中包含：

```text
X-Request-Trace-Id: trace_xxx
```

如果遇到异常，请把该 trace ID 提供给管理员，用于在 Usage → 链路追踪中定位问题。

---

## 流式注意事项

- 流式请求使用 SSE（Server-Sent Events）。
- 如果启用首 token 超时切换，客户端收到的流事件顺序保持一致。
- 跨协议流式不支持；请确保客户端协议与上游 endpoint 匹配，或请求非流式响应。
