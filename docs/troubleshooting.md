# 常见问题与排查

本文档汇总管理员在日常运维中可能遇到的问题和排查步骤。

---

## 通用排查流程

遇到异常时，建议按以下顺序排查：

1. 检查服务健康：`GET /healthz` 和 `GET /readyz`。
2. 查看管理后台 **Overview** 总览卡片，定位异常维度。
3. 按上游密钥、应用、Consumer Key 等维度查看 **Usage**。
4. 找到失败的 trace ID，查看链路详情。
5. 检查 **Circuit Breakers** 和 **Endpoint Health** 页面。
6. 查看服务日志（注意日志默认已脱敏）。

---

## 无法登录管理后台

### 现象

访问管理后台登录页后，提示用户名或密码错误。

### 排查

1. 确认使用的是环境变量中设置的 `MODELHARBOR_ADMIN_USERNAME` 和 `MODELHARBOR_ADMIN_PASSWORD`。
2. 如果忘记密码，目前无法通过 UI 重置。需要通过数据库删除管理员账号让系统重新创建，或修改环境变量后重启。
3. 检查登录失败是否触发速率限制，稍后再试。

---

## 下游返回 401

### 现象

客户端收到 `401 Invalid or revoked consumer key`。

### 排查

1. 检查请求头是否正确：
   - `Authorization: Bearer mh_...`
   - 或 `x-api-key: mh_...`
2. 检查 Consumer Key 是否被 **Revoke**。
3. 检查 Consumer Key 所属 App 是否被禁用。
4. 确认 key 没有多字、少字或包含空格。

---

## 下游返回 403

### 现象

客户端收到 `403 Consumer key has no access to this model`。

### 排查

1. 进入对应 App 的 Consumer Key 详情页。
2. 检查 **Access** 标签，确认该 key 已授权访问请求的模型或模型组。
3. 如果请求的是模型组，确认组内至少有一个成员公共模型对该 key 可访问（通常授权到模型组即可）。

---

## 下游返回 404

### 现象

客户端收到 `404 Model name not found`。

### 排查

1. 检查请求的 `model` 字段拼写。
2. 确认该名称是公共模型名或模型组名，而不是上游真实模型名。
3. 确认该公共模型/模型组已启用。
4. 用 `GET /v1/models` 查看当前 Consumer Key 可见的模型列表。

---

## 下游返回 429 / 503

### 现象

客户端收到 `429 All candidates unavailable` 或 `503 No available upstream route`。

### 排查

1. 进入 **Upstream Keys**，检查对应上游密钥：
   - 是否被 **Frozen**（配额耗尽）
   - 是否处于 **Cooldown**（限流/超时触发）
   - 是否被 **Disabled**
2. 进入 **Circuit Breakers**，查看是否有 open 状态的熔断器。
3. 进入 **Endpoint Health**，查看 endpoint 是否降级或探测失败。
4. 检查上游密钥的 API key 是否有效、是否过期、是否被供应商侧撤销。
5. 如果是配额耗尽，手动 **Unfreeze** 或等待周期重置。

---

## 上游密钥认证失败

### 现象

请求走到某条上游密钥后返回 401/403，错误类型为 `provider_authentication` 或 `provider_permission`。

### 排查

1. 在 **Upstream Keys** 中点击 **Rotate secret**，重新填写正确的 API key。
2. 如果是 OAuth 方式，检查 token 是否过期，必要时重新授权。
3. 确认该上游账号有权限调用对应的真实模型。
4. 检查是否误用了国内/国际 endpoint（例如 Moonshot-cn vs Moonshot）。

---

## 模型响应为空或不正确

### 现象

客户端收到响应，但内容不符合预期。

### 排查

1. 确认客户端请求的 `model` 字段映射到了预期的上游真实模型。
2. 在 **Public Models** 中检查候选的 real name 是否正确。
3. 检查是否有多个候选，请求是否被路由到了非预期的候选。
4. 使用 trace ID 查看链路详情，确认最终选中的上游 key 和 real model。

---

## 熔断器频繁打开

### 现象

某个 `(upstream key, real model)` 经常被熔断。

### 排查

1. 查看熔断器详情中的 **Last error code**，确认失败类型。
2. 如果是 `provider_rate_limit` 或 `provider_quota`，说明上游限流或配额不足。
3. 如果是 `provider_timeout`，检查网络延迟或上游服务状态。
4. 在 **Settings → Circuit Breaker** 中适当调整阈值（注意不要调得过于宽松，避免掩盖真实问题）。
5. 如果是误判，可手动 **Reset** 熔断器。

---

## Endpoint 持续降级

### 现象

某个上游 endpoint 在 **Endpoint Health** 中显示为 degraded。

### 排查

1. 检查该 endpoint 的 base URL 是否正确。
2. 从服务器直接 `curl -I <baseUrl>` 看是否可达。
3. 检查网络、DNS、防火墙、代理是否阻止了探测请求。
4. 如果该 endpoint 本身对 HEAD 请求不友好，可在 **Settings** 中调整探测超时或降级阈值。

---

## 用量统计为 0

### 现象

**Usage** 页面没有数据。

### 排查

1. 确认时间窗口选择正确（today / 24h / 7d）。
2. 确认有流量实际经过网关，而不是直接访问上游。
3. 检查是否有筛选条件过滤掉了数据。
4. 确认数据库写入正常（查看 `/readyz`）。

---

## 内容日志没有记录

### 现象

开启了内容日志，但查不到记录。

### 排查

1. 进入 **Settings → Content Logging**，确认开关为 **Enabled**。
2. 确认请求发生在保留期内。
3. 确认请求是成功请求（当前版本失败请求不记录内容日志）。
4. 检查 `maxPayloadBytes`，确认内容没有被过滤规则排除。

---

## 性能问题

### 现象

首次 token 延迟高、响应慢。

### 排查

1. 查看 **Endpoint Health**，选择延迟低的候选。
2. 检查是否触发了首 token 超时切换，查看流式设置。
3. 检查上游密钥是否过载或限流。
4. 如果是跨协议转换导致的非流式请求延迟，考虑为客户端协议配置匹配的 upstream endpoint。

---

## 收集信息模板

如果问题无法自行解决，需要向开发团队或社区求助，请提供：

- 服务版本 / 镜像 tag
- `MODELHARBOR_LOG_LEVEL=debug` 下的相关日志（脱敏后）
- `/healthz` 和 `/readyz` 输出
- 出错的 trace ID
- 相关上游密钥名、公共模型名、Consumer Key 前缀
- 复现请求的 curl（替换敏感 key 为占位符）
