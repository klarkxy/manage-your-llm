# ManageYourLLM 产品决策记录

本文档记录重构前 grilling 得到的产品取舍。它优先于旧项目里的默认假设，用于指导新分支实现。

## 1. 产品定位

- 产品名：`ManageYourLLM`
- 中文定位：管理你的大模型
- 类型：个人自用的大模型网关与 Provider 管理台
- 目标用户：个人开发者 / 自己维护多个 LLM provider 和客户端工具的人
- 不是：组织平台、商业转售平台、多租户 SaaS、支付/充值系统

核心优先级：

1. 稳定路由 / failover
2. 管理 UI 好用
3. 部署简单
4. 长期可维护、好重构、好加功能

## 2. 商业与成本边界

不做：

- 充值
- 支付
- 分账
- 售卖模型
- 企业账单
- 多用户余额

要做：

- 个人请求成本估算
- provider/model token 单价维护
- 每日/月度成本统计
- coding plan / token plan 维护
- 购买时间、到期时间、续费提醒
- 手动维护剩余额度或周期额度

预留：

- 预算阈值
- 套餐快用完或快到期提醒
- 未来路由策略可参考 plan 状态，例如余额优先或成本优先

## 3. 首版保留、后移和不做

首版必须保留：

- Anthropic Messages
- OpenAI Chat Completions
- OpenAI Responses
- Models List
- 上游 key 管理
- provider preset
- public model
- model group
- failover
- cooldown
- circuit breaker
- endpoint health
- sticky routing
- trace
- usage
- 成本统计和套餐账本
- 模型参考榜单
- 管理 UI
- 备份/恢复
- Setup Wizard

后移：

- Coze OAuth
- 自动模型组高级策略
- 多语言完整覆盖
- 托盘伴侣程序
- 本机客户端配置文件自动写入
- 智能路由策略

不做：

- Codex OAuth / codex-auth
- 组织 / 租户 / RBAC
- OIDC / SSO
- PostgreSQL
- 旧数据库自动迁移

## 4. 技术栈

继续使用：

- Node.js + TypeScript
- Fastify
- SQLite + Drizzle
- Vue 3 + Vite + Naive UI
- pnpm workspace
- Vitest + Playwright

新增或强化：

- Zod 作为共享 API contract / payload validation
- repository / service / domain 分层
- resource composables 管理前端数据获取

原则：

- SQLite 是长期主数据库。
- 单进程一体化部署。
- Node 直跑和 Docker 都支持，生产推荐 Docker。
- 不为了 PostgreSQL 做额外复杂抽象。

## 5. 部署与安全

部署形态：

- 一个 Node/Fastify 进程。
- 同一端口服务管理 UI、管理 API、网关 API、健康检查。
- 同进程运行后台维护任务。
- 支持公网部署。
- Docker 是推荐生产部署方式。

安全要求：

- 管理后台默认必须登录。
- 本地管理员账号 + HTTP-only session cookie。
- 登录失败限流。
- 生产模式拒绝默认管理员密码和默认 secret。
- 支持 reverse proxy / public base URL / trust proxy。
- Consumer Key 创建后只显示一次。
- 内容日志默认不记录。

## 6. 数据与迁移

- 新版本使用全新 schema。
- 不兼容旧数据库。
- 不提供旧库平滑迁移。
- 未来如有需要，可做 best-effort importer，但不纳入核心架构。

备份/恢复是首版重点：

- 完整 SQLite 数据库备份。
- 升级/迁移前自动备份。
- 手动备份。
- 恢复前先备份当前数据库。
- 备份文件包含 schema version 和时间戳。
- 支持非敏感配置导出。

备份类型：

- 完整数据库备份：包含加密后的上游 key、Consumer Key hash、配置和用量。恢复时需要同一个 secret key。
- 非敏感配置导出：不包含原始 secret，导入后需要重新填 key。

## 7. 路由哲学

核心原则：

- 默认可预测、可解释。
- 未来允许智能策略，但首版不做黑箱调度。
- failover 稳定性优先。

failover 策略：

- 采用激进 failover。
- 上游返回 `auth`、`permission`、`model_not_found`、`bad_request`、`rate_limit`、`quota`、`timeout`、`overloaded`、网络错误等，都继续尝试后续候选。
- 必须设置每请求最大尝试数。
- trace 必须记录每个候选失败原因。
- 对 `bad_request`、`auth`、`permission`、`model_not_found` 是否触发长冷却要谨慎。

sticky routing：

- 是核心能力，不是后续优化。
- conversation sticky 和短窗口 session sticky 都保留。
- sticky 只能调整候选优先级，不能绕过禁用、冻结、配额、熔断或能力过滤。
- sticky 命中、失效、替换必须进入 trace。

## 8. Public Model 与 Model Group

Public Model：

- 表示多供应商池 / 同语义模型别名。
- 例如 `gpt-5` 可包含多个 provider 的 `gpt-5` 或近似可替代候选。
- public model candidates 负责同名/相似模型的 failover。

Model Group：

- 表示业务语义组。
- 例如 `coder`、`fast`、`cheap`、`reasoning`。
- 成员是多个 public model。
- 不用 model group 替代 public model 的供应商池职责。

## 9. 模型参考榜单

首版角色：

- 配置助手。
- 展示模型分数、价格、上下文、速度、延迟、来源。
- 辅助生成 public model 和 model group 推荐。
- 推荐结果必须由用户确认后才写入配置。

不做：

- 首版不参与实时路由。
- 首版不支持用户自定义榜单来源。
- 首版只使用固定内置来源。

未来预留：

- 榜单评分参与智能路由。
- 成本、速度、质量、上下文窗口成为策略权重。

## 10. Provider Preset

策略：

- 内置核心 provider preset。
- 支持本地自定义 provider preset。
- preset 是模板，不保存 secret。
- upstream key 是实例，保存密文和用户配置。
- 可从现有 upstream key 另存为 preset。

preset 可包含：

- endpoints
- provider type
- auth strategy
- default headers / params
- model discovery URL
- guide URL
- API key URL
- docs URL
- default model
- model examples
- branding icon/color
- capabilities

## 11. 管理 UI

工作流：

- 首次启动显示 Setup Wizard。
- 之后可重新打开 Setup Wizard。
- 首次配置使用向导。
- 日常维护使用高密度表格、抽屉和批量操作。
- 模型发现后使用确认映射流程。
- Usage/Trace 可跳转到相关 upstream key / public model。
- 成本/套餐用个人账本形态呈现。

Setup Wizard：

1. 安全检查
2. 添加第一个 upstream
3. 发现模型
4. 创建 Consumer Key
5. 测试请求

语言：

- 中文优先。
- 保留 i18n 结构。
- 首版不强制完整多语言覆盖。

## 12. 客户端支持

协议支持：

- Anthropic Messages
- OpenAI Chat Completions
- OpenAI Responses
- Models List

首版客户端配置助手重点：

- Claude Code
- Codex 类客户端
- OpenCode
- Hermes
- Cherry Studio
- 通用 OpenAI-compatible 客户端

原则：

- 不自动写本机配置文件。
- 只生成可复制配置片段。
- 配置助手不影响网关核心。

## 13. 可观测与日志

保留策略：

- trace：固定保留 30 天。
- usage records：长期保留。
- daily consumption stats：永久保留。
- audit：长期保留。
- backups：自动备份保留最近 N 个；手动备份策略待定。

内容日志：

- 不做长期内容日志。
- 只做临时调试模式。
- 默认关闭。
- 手动开启后只记录短时间窗口或最近 N 条。
- 自动关闭。
- 写入前脱敏和截断。
- UI 必须明显提示正在记录内容。

## 14. 健康探测

采用：

- 自动轻量探测。
- 手动模型 ping。

规则：

- 后台定期探测 endpoint 可达性和延迟。
- 默认不自动向每个模型发 token 请求，避免产生费用。
- 在 Upstream/Public Model 页面提供手动 ping。
- 真实请求结果反哺健康状态。
- 健康排序可结合 endpoint 探测和最近真实请求结果。

## 15. 后续增强

Tray companion：

- 后续增强，不进首版。
- 可参考 cc-switch 的 Tauri tray。
- 只负责打开管理台、展示服务状态、打开 provider 官网/API key 页面。
- 不承载核心业务逻辑。

智能路由：

- 后续增强。
- 策略可能包括成功率、延迟、成本、模型榜单、套餐余额。
- 必须可解释、可关闭。

