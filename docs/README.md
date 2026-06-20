# ModelHarbor 管理员手册

本手册面向需要部署、配置和维护 ModelHarbor 的**系统管理员 / 运维人员**。它按实际工作流程组织，帮助你从一台空服务器走到“下游应用可以正常调用模型”。

> 如果你是希望接入 ModelHarbor 网关的下游开发者，请阅读 [API 使用指南](api-usage.md)。

---

## 适用场景

- 你负责部署 ModelHarbor 服务。
- 你需要把多个上游 LLM 供应商（OpenAI、Anthropic、DeepSeek、Moonshot 等）的 API key 集中管理。
- 你想给不同应用分配不同的 Consumer Key，并控制它们能访问哪些模型。
- 你需要监控用量、排查路由失败、维护服务可用性。

---

## 核心概念（5 分钟速览）

| 概念 | 简单解释 | 管理员操作对象 |
| --- | --- | --- |
| **Upstream Key** | 真实的上游供应商实例，包含 base URL、API key、配额、健康状态。 | 在管理后台「上游密钥」页面添加。 |
| **Public Model** | 客户端看到的模型名称，例如 `gpt-4o`。它映射到一个或多个上游真实模型候选。 | 在「公共模型」页面定义。 |
| **Model Group** | 管理员自定义的模型分组，例如 `coder`、`cheap`、`fast`。客户端可以像请求单个模型一样请求一个组。 | 在「模型组」页面创建。 |
| **App** | 应用维度的租户边界，用于聚合用量和管理 Consumer Key。 | 在「应用」页面创建。 |
| **Consumer Key** | 下游应用调用网关时使用的 key，形如 `mh_...`。每个 key 只能访问被授权的模型或模型组。 | 在应用详情页创建。 |

---

## 推荐阅读路线

### 第一次部署

1. [快速开始](getting-started.md) — 安装、启动、登录、跑通第一条请求。
2. [部署与运维](deployment.md) — 生产环境变量、数据持久化、备份、升级、健康检查。
3. [安全配置](security.md) — 设置加密密钥、修改默认密码、理解密钥与审计策略。

### 日常配置

1. [上游密钥配置](upstream-keys.md) — 添加供应商 key、发现模型、设置配额、轮换密钥。
2. [模型管理](models.md) — 创建公共模型、配置候选、创建模型组。
3. [应用与 Consumer Key](apps-and-keys.md) — 给下游应用发 key、控制访问范围。

### 运行维护

1. [路由与韧性](routing-and-resilience.md) — 理解路由、熔断、健康探测、会话粘性、负载均衡。
2. [用量与监控](usage-and-monitoring.md) — 查看统计、链路追踪、日志、告警。
3. [常见问题与排查](troubleshooting.md) — 401/403/404/429/503、上游认证失败、配额耗尽等。

---

## 管理后台入口

开发环境：

```text
http://localhost:5421
```

生产环境：

```text
http://<your-host>/
```

生产模式或设置 `MODELHARBOR_SERVE_WEB=1` 后，API 进程会托管已构建的前端，并对非 API 路径做 SPA fallback。

---

## 下游调用入口

| 协议 | 端点 |
| --- | --- |
| OpenAI Chat Completions | `POST /v1/chat/completions` |
| Anthropic Messages | `POST /v1/messages` |
| OpenAI Responses | `POST /v1/responses` |
| 模型列表 | `GET /v1/models` |

---

## 上游密钥获取指引

每个供应商的「如何获取 API key」指引放在 [provider-guides/README.md](provider-guides/README.md)。在管理后台新建上游密钥时，抽屉里也会提供对应链接。
