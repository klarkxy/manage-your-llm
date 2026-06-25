# 部署指南

ManageYourLLM 是单进程 Node 应用，内置管理 UI、管理 API、网关 API 和健康检查。推荐使用 Docker 部署到生产环境。

## 目录

- [Docker 部署](#docker-部署)
- [环境变量](#环境变量)
- [目录与卷](#目录与卷)
- [反向代理与 HTTPS](#反向代理与-https)
- [直接运行（开发/测试）](#直接运行开发测试)
- [升级](#升级)

## Docker 部署

### 构建镜像

在项目根目录执行：

```bash
docker build -t manageyourllm:latest .
```

镜像采用多阶段构建：

- Stage 1：安装依赖并构建前后端。
- Stage 2：仅保留生产依赖与构建产物，体积更小。

### 最小运行示例

```bash
docker run -d \
  --name manageyourllm \
  -p 5420:5420 \
  -e NODE_ENV=production \
  -e MYLLM_SECRET_KEY='替换为强随机字符串' \
  -e MYLLM_ADMIN_USERNAME='administrator' \
  -e MYLLM_ADMIN_PASSWORD='替换为强密码' \
  -v manageyourllm-data:/app/data \
  -v manageyourllm-logs:/app/logs \
  -v manageyourllm-backups:/app/backups \
  manageyourllm:latest
```

生产环境必须替换 `MYLLM_SECRET_KEY`、`MYLLM_ADMIN_USERNAME`、`MYLLM_ADMIN_PASSWORD` 的默认值，否则容器启动会抛出错误并退出。

### 使用 docker compose

```yaml
services:
  manageyourllm:
    image: manageyourllm:latest
    container_name: manageyourllm
    restart: unless-stopped
    ports:
      - "5420:5420"
    environment:
      NODE_ENV: production
      MYLLM_SECRET_KEY: ${MYLLM_SECRET_KEY}
      MYLLM_ADMIN_USERNAME: ${MYLLM_ADMIN_USERNAME}
      MYLLM_ADMIN_PASSWORD: ${MYLLM_ADMIN_PASSWORD}
      MYLLM_PUBLIC_BASE_URL: https://llm.example.com
      MYLLM_TRUST_PROXY: "true"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./backups:/app/backups
```

> 注意：默认进程以非 root 用户 `manageyourllm` 运行，因此宿主机挂载目录需要保证容器内可写，或预先创建并授权。

## 环境变量

所有环境变量均支持 `MYLLM_` 和 `MANAGE_YOUR_LLM_` 两种前缀。例如 `MYLLM_SECRET_KEY` 等价于 `MANAGE_YOUR_LLM_SECRET_KEY`。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `MYLLM_SECRET_KEY` | 是 | 用于加密上游密钥和 Consumer Key hash。首次设置后不可更改，否则已有加密数据无法解密。 |
| `MYLLM_ADMIN_USERNAME` | 是 | 初始管理员用户名。 |
| `MYLLM_ADMIN_PASSWORD` | 是 | 初始管理员密码。 |
| `MYLLM_ADMIN_DISPLAY_NAME` | 否 | 管理员显示名，默认 `Admin`。 |
| `MYLLM_DATABASE_URL` | 否 | SQLite 路径，默认 `file:./data/manageyourllm.sqlite`。 |
| `MYLLM_PUBLIC_BASE_URL` | 否 | 对外可访问地址，如 `https://llm.example.com`。为空时回退到 `http://localhost:${PORT}`。 |
| `MYLLM_HOST` | 否 | 绑定地址，默认 `0.0.0.0`。 |
| `MYLLM_PORT` | 否 | 监听端口，默认 `5420`。 |
| `MYLLM_TRUST_PROXY` | 否 | Fastify `trustProxy` 配置。空字符串表示不信任任何上游 hop。 |
| `MYLLM_LOG_LEVEL` | 否 | 日志级别，默认 `info`。 |
| `MYLLM_LOG_FILE` | 否 | 日志文件路径，默认 `./logs/app.log`。 |

## 目录与卷

| 容器内路径 | 用途 | 建议挂载 |
| --- | --- | --- |
| `/app/data` | SQLite 数据库 | 必须持久化 |
| `/app/logs` | 应用日志 | 建议持久化 |
| `/app/backups` | 备份文件 | 建议持久化 |

## 反向代理与 HTTPS

ManageYourLLM 单个端口同时服务 Web、Admin API 和 Gateway API。反向代理只需把根路径全部转发到后端端口。

### Nginx 示例

```nginx
server {
    listen 443 ssl http2;
    server_name llm.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:5420;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

### Caddy 示例

```caddy
llm.example.com {
    reverse_proxy 127.0.0.1:5420
}
```

配置反向代理后，将 `MYLLM_PUBLIC_BASE_URL` 设置为 `https://llm.example.com`，并根据信任范围设置 `MYLLM_TRUST_PROXY`。

## 直接运行（开发/测试）

```bash
pnpm install
pnpm build
pnpm --filter @manageyourllm/api start
```

开发环境可使用：

```bash
pnpm dev
```

此时前端运行在 `http://127.0.0.1:5421`，并通过 Vite 代理转发 `/api` 与 `/v1` 到后端。

## 升级

1. 进入管理台 Backups 页面创建完整数据库备份。
2. 拉取新版本镜像或源码。
3. 若从源码构建：
   ```bash
   docker build -t manageyourllm:latest .
   ```
4. 使用原有数据卷启动新容器：
   ```bash
   docker run -d --name manageyourllm-new \
     -p 5420:5420 \
     -v manageyourllm-data:/app/data \
     -v manageyourllm-logs:/app/logs \
     -v manageyourllm-backups:/app/backups \
     -e MYLLM_SECRET_KEY='原有 secret' \
     -e MYLLM_ADMIN_USERNAME='administrator' \
     -e MYLLM_ADMIN_PASSWORD='强密码' \
     manageyourllm:latest
   ```

> 升级后若数据库 schema 发生变更，启动时会自动迁移。迁移前建议保留备份。
