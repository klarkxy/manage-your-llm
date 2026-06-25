# 排障指南

ManageYourLLM 的大部分问题都可以通过 **Traces（请求追踪）** 页面定位。Trace 会记录一次请求的完整生命周期：目标解析、候选展开、过滤原因、sticky 命中、每次尝试结果。

## 查看 Trace

1. 登录管理台，进入 **Traces** 页面查看最近请求列表。
2. 点击某行进入 **Trace Detail**，查看时间线。
3. 在时间线中关注每一步的 `type` 和 `message`。

## 常见问题速查

### 认证失败（Authentication / Unauthorized）

**Trace 特征**：请求在网关入口即失败，无后续候选尝试。

**检查点**：

- 客户端是否使用了正确的 Consumer Key（`Authorization: Bearer <key>`）。
- Consumer Key 是否被吊销（Revoke）或删除。
- 前往 **Apps** 页面查看对应 Consumer Key 的状态。

### 模型不存在（model_not_found / Target not found）

**Trace 特征**：目标解析失败或候选展开为空。

**检查点**：

- 请求的 `model` 字段是否对应一个存在的 Public Model 或 Model Group。
- Public Model 是否配置了候选（candidates）。
- Public Model / Model Group 是否被禁用。

### 访问被拒绝（permission / access denied）

**Trace 特征**：目标解析成功，但在访问控制阶段失败。

**检查点**：

- Consumer Key 的 access mode 是否为 `restricted`。
- restricted key 是否被授予了目标 Public Model 或 Model Group。
- 前往 **Apps** 页面编辑 Consumer Key 的访问目标。

### 速率限制（rate_limit）

**Trace 特征**：上游返回 429，网关继续尝试后续候选。

**检查点**：

- 该 upstream key 的配额是否已用完（**Upstream Keys** 页面查看 quota）。
- 是否需要临时冻结该候选或调整路由权重。

### 配额耗尽（quota）

**Trace 特征**：上游返回 quota 错误。

**检查点**：

- 进入 **Upstream Keys** 页面，检查对应 key 的 quota 周期用量。
- 如有需要，调整 quota 或更换 key。

### 超时 / 过载（timeout / overloaded）

**Trace 特征**：候选请求超时或返回 503，网关继续 failover。

**检查点**：

- **Upstream Keys** 页面查看 endpoint health 状态。
- 检查 Circuit Breaker 是否已将该上游置为打开状态。
- 查看 **Settings** 中的 `defaultRequestTimeoutMs` 和 `firstTokenTimeoutMs` 是否过短。

### Sticky 未命中

**Trace 特征**：sticky binding 存在但本次请求未命中，或 sticky 失效。

**检查点**：

- 确认请求是否携带了与 sticky 匹配的对话 ID。
- Sticky 只能调整优先级，不会绕过禁用、配额、熔断等过滤条件。
- 前往 **Settings** 确认 `enableStickySession` 已开启。

###  failover 全部失败

**Trace 特征**：所有候选都尝试失败，最终返回最后一个错误。

**检查点**：

- 检查每个候选的失败原因（auth、model_not_found、timeout 等）。
- 确认 Public Model 的候选列表中至少有一个可用上游。
- 查看 **Upstream Keys** 页面是否有候选被冻结或熔断。

## 日志与调试

- 应用日志默认写入 `./logs/app.log`，可通过 `MYLLM_LOG_FILE` 配置。
- 如需查看请求/响应内容，可临时开启 **Debug Content Logs**：
  1. 进入 **Debug Logs** 页面。
  2. 选择记录时长和最大条数。
  3. 记录结束后会自动关闭，内容中已脱敏处理（隐藏 API key、token 等）。

##  still stuck？

请导出相关 Trace ID 和最近日志片段，结合以下信息排查：

- 目标 Public Model / Model Group 名称。
- 使用的 Consumer Key 前缀（Apps 页面可见）。
- 上游 key 的健康状态。
