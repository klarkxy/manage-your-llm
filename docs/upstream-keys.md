# 上游密钥配置

上游密钥（Upstream Key）是 ModelHarbor 连接真实供应商的凭证。每条上游密钥对应一个供应商实例，包含 base URL、认证方式、配额、健康状态等信息。

---

## 概念

- **Provider preset**：系统内置的供应商模板，例如 OpenAI、DeepSeek、Moonshot。选择 preset 后会自动填充 endpoint、provider type 和默认认证方式。
- **真实模型名（real model name）**：供应商 API 中实际使用的模型 ID，例如 `gpt-4o-2024-08-06`。
- **公共模型名（public model name）**：你想暴露给下游客户端的名称，例如 `gpt-4o`。
- **认证策略**：
  - `pat`：静态 API key（最常见）。
  - `coze_oauth_jwt`：Coze 的 JWT OAuth。
  - `coze_oauth_pkce`：Coze 的浏览器 PKCE OAuth。

---

## 支持的供应商

ModelHarbor 内置约 28 个可见 provider preset，覆盖国际和国内主流供应商：

OpenAI、Anthropic、Coze、DeepSeek、Moonshot（国际/国内）、MiniMax（国际/国内）、OpenRouter、OpenCode Go / Zen、Groq、Together AI、Cerebras、Fireworks AI、xAI (Grok)、阿里云通义千问（国内/国际）、智谱 GLM / GLM Coding、硅基流动、百川、字节火山方舟、腾讯混元、百度千帆、阶跃星辰、Agnes AI、Kimi Code。

每个供应商的「如何获取 API key」指引见 [provider-guides/README.md](provider-guides/README.md)。

---

## 创建上游密钥

1. 进入管理后台 **Upstream Keys → New upstream key**。
2. 在 **Provider preset** 下拉框中选择供应商。列表会显示图标和名称。
   - 选择后，系统会自动填充 endpoint、provider type 和推荐认证方式。
   - 点击链接可跳转到该供应商的密钥获取指引。
3. 填写 **API key** 或按指引完成 OAuth 配置。
4.（可选）点击 **Fetch models** 从供应商的 `/v1/models` 端点自动发现模型列表。拉取后 public name 会自动转小写存储。
5. 填写模型映射。每一行包含：
   - **Real name**：供应商处的真实模型 ID。
   - **Public name**：展示给下游的别名（可选，留空则与 real name 相同）。保存时会自动转小写。
   - **Enabled**：是否启用该映射。
6. 设置配额（可选）：
   - Period：`hour` / `day` / `week` / `month` / `total`。
   - Request / input / output / total token 限制。
7. 保存。原始 API key 只会显示一次。

> 如果你不清楚某个供应商的真实模型名，建议先用 **Fetch models** 拉取，或在供应商控制台查看文档。

---

## 多 Endpoint 与自定义路径

部分供应商同时提供 Anthropic 兼容和 OpenAI 兼容两个 endpoint（例如 DeepSeek、MiniMax）。选择 preset 后，系统会自动配置多个 endpoint。ModelHarbor 会根据客户端协议自动选择合适的一个。

如果某个 endpoint 使用非标准路径（例如智谱 `/v4/chat/completions`、火山方舟 `/v3/chat/completions`），preset 中会通过 `apiPath` 覆盖默认路径，管理员无需手动填写。

---

## 认证方式说明

### PAT（静态 API key）

适用于 OpenAI、Anthropic、DeepSeek 等大多数供应商。直接在表单中粘贴 key 即可。

### Coze OAuth JWT

需要填写：

- `appId`
- `kid`（密钥 ID）
- `privateKey`（私钥内容）
- `durationSeconds`（Token 有效期，默认 900 秒）

### Coze OAuth PKCE

适合浏览器流。点击 **Authorize with browser** 后，系统会跳转到 Coze 授权页面，完成后自动创建上游密钥。

## 配额与限流

配额只对上游密钥生效。当达到任一限制时，该上游密钥会被 **frozen**，路由时会自动跳过，直到：

- 周期重置（例如新的月份）。
- 管理员在管理后台手动 **Unfreeze**。

支持的配额维度：

- 请求次数
- 输入 token 数
- 输出 token 数
- 总 token 数

> 当前版本没有本地 RPM/TPM 计数器。上游返回的 rate limit 会触发短暂冷却（cooldown），而不是本地限流。

---

## 维护操作

上游密钥列表每行右侧提供一组图标按钮，鼠标悬停可查看功能说明：

| 图标 | 说明 |
| --- | --- |
| 闪电 | **Ping**：测试某个候选模型是否可达。 |
| 心脏/脉搏 | **Health**：查看每个 endpoint 的探测延迟和是否降级。 |
| 铅笔 | **Edit**：编辑上游密钥。 |
| 复制 | **Duplicate**：复制该 PAT 上游密钥（仅 `authType=pat` 可用）。 |
| 垃圾桶 | **Delete**：删除上游密钥。 |
| 左侧拖动符号 | 拖拽排序上游密钥。未手动编排过的公共模型会按此顺序作为默认候选顺序。 |

---

## 健康与排障

- 上游密钥列表会显示 **frozen**、**cooldown**、**degraded** 等状态标签。
- 如果某个 endpoint 持续降级，系统会在后台健康探测中标记，并优先选择健康的 endpoint。
- 如果所有候选都不可用，客户端会收到 `503` 或 `429` 错误。排查方法见 [常见问题与排查](troubleshooting.md)。

---

## 新增自定义供应商

如果你需要接入一个未内置的 OpenAI 兼容或 Anthropic 兼容供应商：

1. 在 **New upstream key** 中选择 **Manual configuration**。
2. 手动填写 provider type、base URL、API key。
3. 如果需要非标准路径，在 endpoint 中填写 `apiPath`。

对于需要全新 adapter 的协议，需要开发团队扩展 provider descriptor，当前不在管理员操作范围内。
