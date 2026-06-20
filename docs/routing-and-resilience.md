# 路由与韧性

理解 ModelHarbor 如何选择上游、处理失败、保持服务可用，是日常运维和排障的基础。

---

## 一次请求的完整流程

1. **认证**：校验 Consumer Key，解析出所属 App。
2. **解析目标**：把客户端请求的 `model` 字段解析为公共模型或模型组。
3. **权限检查**：确认 Consumer Key 有权访问该目标。
4. **展开候选**：把目标展开为 `(upstream key, real model name)` 候选列表。
5. **过滤候选**：剔除被禁用、冻结、冷却中、超过配额、熔断器打开或能力不匹配的候选。
6. **端点健康排序**：降级或高延迟 endpoint 会排到后面，但不会仅因降级被直接剔除。
7. **模型组策略**：模型组会按 `priority` / `round_robin` / `random` / `weighted` 等策略调整候选顺序。
8. **粘性检查**：如果同一会话之前绑定到某个仍可用的候选，优先复用。
9. **协议转换**：根据客户端协议和上游适配器转换请求。
10. **发送上游请求**并接收响应或流事件。
11. **记录用量**：写入请求数、token、延迟、状态、选中的上游 key。
12. **更新状态**：必要时触发配额冻结或冷却。

> **可用性优先于粘性**。如果之前绑定的候选失效，系统会重新选择。

---

## 协议支持

| 客户端协议 | 上游适配器 |
| --- | --- |
| Anthropic Messages (`/v1/messages`) | `anthropic_compatible` / `openai_compatible` |
| OpenAI Chat Completions (`/v1/chat/completions`) | `openai_compatible` / `anthropic_compatible` |
| OpenAI Responses (`/v1/responses`) | `openai_compatible` |

同一个上游密钥可能同时声明 Anthropic 和 OpenAI 两个 endpoint（如 DeepSeek、MiniMax）。ModelHarbor 会根据客户端协议自动选择匹配的 endpoint。

**同协议流式**：支持。
**跨协议流式**：不支持。如果 OpenAI 客户端路由到 Anthropic 兼容上游且请求了 stream，会返回校验错误。
**跨协议非流式**：支持，通过适配器转换响应。

---

## 熔断器（Circuit Breaker）

熔断器按 `(upstream key, real model name)` 维度跟踪失败。当连续失败次数达到阈值时，熔断器进入 `open` 状态，该候选会被暂时跳过。

### 状态

| 状态 | 含义 |
| --- | --- |
| `closed` | 正常，允许流量。 |
| `open` | 熔断中，跳过该候选，直到冷却结束。 |
| `half_open` | 试探期，允许少量请求验证是否恢复。 |

### 配置项

在 **Settings → Circuit Breaker** 中配置：

- **Enabled**：是否启用熔断。
- **Failure threshold**：触发熔断的连续失败次数（默认 5）。
- **Base cooldown**：首次熔断的冷却时间（默认 60 秒）。
- **Max cooldown**：最大冷却时间（默认 600 秒）。
- **Half-open success count**：半开状态需要连续成功多少次才关闭熔断。

### 手动重置

在 **Circuit Breakers** 页面可以查看所有熔断状态，并手动重置某个熔断器。

---

## 端点健康探测

后台任务会定期向每个 upstream endpoint 的 base URL 发送轻量级 `HEAD` 请求，记录：

- 延迟（delay ms）
- 是否降级（degraded）
- 最近一次检查时间

### 配置项

在 **Settings → Endpoint Health Probe** 中配置：

- **Enabled**：是否启用探测。
- **Probe interval**：探测间隔（默认 1 小时）。
- **Probe timeout**：探测超时（默认 10 秒）。
- **Degraded latency threshold**：超过该延迟即标记为降级（默认 5 秒）。

路由时，降级或探测失败的候选会被排在后面，优先使用健康候选。

---

## 会话粘性

ModelHarbor 根据 conversation fingerprint（由 system message、前几条用户/助手消息等稳定前缀计算）来决定是否复用之前的 `(upstream key, real model)`。这有助于提高上游供应商侧的缓存命中率。

- 粘性绑定有过期时间。
- 如果绑定的候选失效，系统会重新选择，不会硬塞到不可用候选。
- 客户端无需传递特殊 header。

---

## 负载均衡策略

模型组支持以下策略：

| 策略 | 行为 |
| --- | --- |
| `failover` / `priority` | 按 priority 从小到大尝试，失败则回退。 |
| `round_robin` | 轮询。 |
| `random` | 随机。 |
| `weighted` | 首次按 weight 加权选择，失败时按 priority 回退。 |

---

## 首 token 超时切换

对于流式请求，如果第一个 SSE 事件在 `firstTokenTimeoutMs` 内未到达，系统会取消当前上游请求并切换到下一个候选。如果首个事件已经到达，系统会保留它并继续返回同一条流。

在 **Settings → Streaming** 中配置：

- `firstTokenTimeoutMs`：默认 15000 毫秒，设为 0 可禁用该功能。

---

## 失败分类

上游错误会被归一化为以下类别，用于决定是重试、冷却还是直接返回：

- `provider_authentication`：上游认证失败。
- `provider_permission`：权限不足。
- `provider_rate_limit`：被上游限流。
- `provider_quota`：上游配额耗尽。
- `provider_timeout`：上游超时。
- `provider_overloaded`：上游过载。
- `provider_model_not_found`：模型不存在。
- `provider_bad_request`：请求格式错误。
- `provider_stream_error`：流式错误。
- `provider_unknown`：其他未知错误。

认证和权限错误不会触发重试；限流、配额、超时、过载会触发冷却和候选切换。
