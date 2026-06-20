# 部署与运维

ModelHarbor 设计为单个可部署服务，无需 Kubernetes。MVP 形态包含 Fastify API 服务、内置 Vue 管理后台和 SQLite 数据库。

---

## 部署形态

- **单服务**：网关 API 与管理后台运行在同一个进程。
- **同域**：管理后台和 API 共享同一域名/端口，避免跨域配置。
- **SQLite**：默认使用 libsql/SQLite，数据库文件可持久化到 `/data` 或自定义路径。

未来如需扩展，可将 admin 与 gateway 拆分为独立进程，并迁移到 PostgreSQL / Redis。当前版本不考虑这些。

---

## 推荐环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MODELHARBOR_HOST` | `0.0.0.0` | 服务监听地址 |
| `MODELHARBOR_PORT` | `5420` | 服务端口 |
| `MODELHARBOR_DATABASE_URL` | `file:./data/modelharbor.sqlite` | SQLite 数据库路径 |
| `MODELHARBOR_SECRET_KEY` | `dev-secret-change-me` | 加密上游 API key 的密钥，**生产环境必须修改** |
| `MODELHARBOR_ADMIN_USERNAME` | `admin` | 初始管理员用户名 |
| `MODELHARBOR_ADMIN_PASSWORD` | `change-me-on-first-run` | 初始管理员密码，**上线前必须修改** |
| `MODELHARBOR_ADMIN_DISPLAY_NAME` | `Admin` | 初始管理员展示名 |
| `MODELHARBOR_LOG_LEVEL` | `info` | 日志级别：`debug`/`info`/`warn`/`error` |
| `MODELHARBOR_LOG_FILE` | `./logs/app.log` | 文件日志路径 |
| `MODELHARBOR_SERVE_WEB` | 未设置 | 非生产模式下设为 `1` 可由 API 进程托管已构建的前端 |
| `NODE_ENV` | `development` | 设为 `production` 时会启用生产校验并托管前端构建产物 |

> ⚠️ **关于 `MODELHARBOR_SECRET_KEY`**：开发环境有默认值便于本地启动，但生产环境会拒绝默认值。一旦使用某个 secret 创建了 upstream key，后续必须保持同一个 key。如果丢失，所有加密的 upstream key 都无法恢复，只能重新创建。

---

## 数据目录

建议把数据库文件挂载到独立目录，例如 `/data`：

```text
/data
├── modelharbor.sqlite      # 数据库
├── modelharbor.sqlite-shm  # SQLite WAL 临时文件
├── modelharbor.sqlite-wal
└── backups/                # 手动备份目录
```

容器部署示例：

```bash
docker run -d \
  -p 5420:5420 \
  -v /host/data:/data \
  -e MODELHARBOR_DATABASE_URL=file:/data/modelharbor.sqlite \
  -e MODELHARBOR_SECRET_KEY=<your-secret> \
  -e MODELHARBOR_ADMIN_PASSWORD=<strong-password> \
  modelharbor:latest
```

---

## 首次启动

首次启动时会自动完成：

1. 运行数据库迁移，创建所有表。
2. 如果还没有管理员账号，使用环境变量创建初始管理员。
3. 在生产模式校验 `MODELHARBOR_SECRET_KEY` 和默认管理员密码是否已修改。

---

## 健康检查

| 端点 | 含义 | 使用场景 |
| --- | --- | --- |
| `GET /healthz` | 进程是否存活 | 负载均衡探活 |
| `GET /readyz` | 数据库可达、迁移已应用 |  readiness 探针、升级验证 |

健康响应不会包含任何密钥或敏感配置。

---

## 备份与恢复

### 备份

1. 建议先停止服务，或使用 SQLite 在线备份工具。
2. 复制数据库文件，例如 `/data/modelharbor.sqlite`。
3. 同时安全保存 `MODELHARBOR_SECRET_KEY`。

### 恢复

1. 停止服务。
2. 将数据库文件还原到数据目录。
3. 确保 `MODELHARBOR_SECRET_KEY` 与备份时一致。
4. 启动服务，访问 `/readyz` 确认正常。

> 如果 secret key 丢失，加密的上游 key 无法解密，需要在管理后台删除并重新创建这些上游密钥。

---

## 升级

1. **备份数据库和 secret key**。
2. 拉取新版本镜像或代码。
3. 启动服务，迁移会自动运行。
4. 检查 `/readyz` 和管理后台登录。
5. 发送一条低风险测试请求，确认网关正常。

MVP 阶段迁移为前向-only。破坏性变更会在 Release Notes 中明确说明。

---

## 日志

默认日志包含：

- 服务启动/关闭
- 管理员登录成功/失败
- 管理员资源变更
- 配额冻结/解冻、熔断事件

默认**不会**记录：

- 原始 Consumer Key
- 原始上游 API key
- 上游原始响应体
- 完整 prompt / completion

如需开启内容日志，请到 **Settings → Content Logging** 配置保留期和最大长度。详见 [安全配置](security.md)。

---

## 未来生产选项（非 MVP）

- PostgreSQL 替代 SQLite。
- Redis 用于计数器、冷却、粘性状态、限流。
- 拆分 gateway 与 admin 服务。
- 多 gateway 副本。
- OIDC 管理员登录。
- 外部 secret manager。

当前版本无需配置这些。
