# 快速开始

本指南帮助你在本地或一台空服务器上完成 ModelHarbor 的首次安装、启动和调用验证。

---

## 环境要求

- Node.js >= 20.10.0
- pnpm >= 9
-（可选）一个上游 LLM 供应商的 API key，例如 OpenAI、Anthropic 或 DeepSeek

---

## 安装

```bash
# 克隆仓库后进入项目根目录
pnpm install
```

---

## 启动开发环境

```bash
pnpm dev
```

这会同时启动：

- 管理后台：`http://localhost:5421`
- API 网关：`http://localhost:5420`

开发模式下，前台代理 API 请求到后台，因此你只需要访问 `5421`。

---

## 首次登录

首次启动时，ModelHarbor 会根据环境变量自动创建管理员账号：

| 环境变量 | 默认值 |
| --- | --- |
| `MODELHARBOR_ADMIN_USERNAME` | `admin` |
| `MODELHARBOR_ADMIN_PASSWORD` | `change-me-on-first-run` |

> ⚠️ **上线前必须修改默认密码**。在生产环境中，请通过环境变量设置强密码。

登录后，建议立即前往 **Settings → 修改密码**。

---

## 健康检查

启动后先确认服务正常：

```bash
curl http://localhost:5420/healthz
# 预期返回：进程存活

curl http://localhost:5420/readyz
# 预期返回：数据库可达、迁移已应用
```

如果 `/readyz` 失败，请检查日志中的数据库连接或迁移错误。

---

## 配置第一条路由（5 分钟）

### 1. 添加上游密钥

进入管理后台 **Upstream Keys → New upstream key**：

- 选择 Provider preset，例如 `OpenAI` 或 `DeepSeek`。
- 填写从供应商处获取的 API key。
- 点击 **Fetch models** 自动发现可用模型，或手动填写模型映射。
- 保存。原始 API key 只会显示一次，请妥善保管。

详细说明见 [上游密钥配置](upstream-keys.md)。

### 2. 创建公共模型

进入 **Public Models → New public model**：

- **Name**：客户端将使用的名称，例如 `gpt-4o`。
- **Display name**：展示用中文名，例如 `GPT-4o`。
- **Candidates**：选择上一步创建的 upstream key 及其真实模型名，例如 `gpt-4o-2024-08-06`。

### 3. 创建应用与 Consumer Key

进入 **Apps → New app**：

- 填写应用名称，例如 `内部 IDE 插件`。
- 进入应用详情页，创建 **Consumer Key**。
- 在 **Access** 标签中，授权该 key 访问刚才创建的公共模型。
- 复制弹窗中的 `mh_...` 密钥。**它只会显示一次**。

### 4. 测试调用

```bash
# OpenAI 协议
curl http://localhost:5420/v1/chat/completions \
  -H "Authorization: Bearer mh_your_consumer_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Anthropic 协议
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

如果收到正常响应，说明整条链路已经跑通。

---

## 下一步

- 阅读 [部署与运维](deployment.md) 了解生产环境配置。
- 阅读 [安全配置](security.md) 设置加密密钥和审计。
- 阅读 [上游密钥配置](upstream-keys.md) 添加更多供应商。
