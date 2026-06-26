# ManageYourLLM

个人自用的大模型网关与 Provider 管理台。

## 环境要求

- Node.js >= 22（推荐 24，见 `.nvmrc`）
- pnpm >= 9

## 安装依赖

```bash
pnpm install
```

## 开发

同时启动 API 与 Web：

```bash
pnpm dev
```

单独启动：

```bash
pnpm dev:api
pnpm dev:web
```

默认端口：

- API：`http://127.0.0.1:5420`
- Web：`http://127.0.0.1:5421`

## 构建

```bash
pnpm build
```

## 类型检查

```bash
pnpm typecheck
```

## 测试

```bash
pnpm test
pnpm e2e        # 需要已安装 Playwright 浏览器
pnpm e2e:install
```

## 代码格式与 lint

```bash
pnpm lint
pnpm format
pnpm format:check
```

## Docker

构建镜像：

```bash
docker build -t manageyourllm:v0.1.0 .
```

运行容器（请替换环境变量）：

```bash
docker run -d \
  -p 5420:5420 \
  -e NODE_ENV=production \
  -e MYLLM_SECRET_KEY=your-secret \
  -e MYLLM_ADMIN_USERNAME=administrator \
  -e MYLLM_ADMIN_PASSWORD=your-password \
  -v manageyourllm-data:/app/data \
  -v manageyourllm-logs:/app/logs \
  -v manageyourllm-backups:/app/backups \
  manageyourllm:v0.1.0
```

## 配置

复制 `.env.example` 为 `.env` 并修改。关键环境变量：

- `MYLLM_PORT` / `MANAGE_YOUR_LLM_PORT`
- `MYLLM_SECRET_KEY` / `MANAGE_YOUR_LLM_SECRET_KEY`
- `MYLLM_ADMIN_USERNAME` / `MANAGE_YOUR_LLM_ADMIN_USERNAME`
- `MYLLM_ADMIN_PASSWORD` / `MANAGE_YOUR_LLM_ADMIN_PASSWORD`
- `MYLLM_DATABASE_URL` / `MANAGE_YOUR_LLM_DATABASE_URL`
- `MYLLM_PUBLIC_BASE_URL` / `MANAGE_YOUR_LLM_PUBLIC_BASE_URL`

## 项目结构

```text
apps/
  api/          Fastify 5 + TypeScript
  web/          Vue 3 + Vite + Naive UI
packages/
  shared/       协议类型、错误、IR、provider descriptor
  contracts/    Zod request/response schema、API envelope
docs/           架构与阶段文档
e2e/            Playwright 端到端测试
```

## 版本

当前版本：`v0.1.0`

Docker 镜像标签：`manageyourllm:v0.1.0`

## 文档

- [架构设计](docs/architecture-rebuild.md)
- [部署指南](docs/deployment.md)
- [备份与恢复](docs/backup-restore.md)
- [客户端配置](docs/client-setup.md)
- [排障指南](docs/troubleshooting.md)
- [阶段 TODO](docs/plans/todos/)
