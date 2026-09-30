# 部署

::: info
目前的部署方式是**编译产物 + 反向代理**。Docker 镜像和 docker-compose 方案会在以后的版本中提供。
:::

## 构建

```bash
pnpm i --frozen-lockfile
pnpm -r build
```

产物位置：

- 服务端：`apps/server/dist/`，工作目录为 `apps/server`，启动命令是 `node dist/main.js`
- 前端：`apps/web/dist/`，纯静态文件，由反向代理托管

## 生产环境变量

在服务器上的 `apps/server/.env`（或者进程环境变量）中至少设置这些项：

```ini
NODE_ENV=production
APP_SECRET=至少32位随机字符串（泄露后要更换，会导致已加密的第三方密钥无法解密）
DB_HOST=… DB_NAME=… DB_USER=… DB_PASSWORD=…
REDIS_HOST=… REDIS_PASSWORD=…
TRUST_PROXY=反向代理的地址      # 不要填整个内网网段
SWAGGER_ENABLED=false           # 生产环境建议关闭接口文档
```

首次部署的数据初始化：

```bash
pnpm db:migrate    # 先执行迁移
pnpm db:seed       # 再写入种子数据
```

::: danger
生产环境不要用 `db:reset`，它会删除所有表。（`NODE_ENV=production` 时这个命令本身也会拒绝执行。）
:::

## 反向代理（nginx）

服务端只监听 `127.0.0.1`，由反向代理对外提供访问。需要配置这几个路径：

| 路径 | 转发到 | 说明 |
| --- | --- | --- |
| `/` | `apps/web/dist/` | SPA 页面，用 `try_files $uri /index.html` 处理前端路由 |
| `/api/` | `http://127.0.0.1:3000` | 接口 |
| `/socket.io/` | `http://127.0.0.1:3000` | WebSocket，需要设置 `Upgrade` 和 `Connection` 头 |
| `/files/` | 本地存储的 `public/` 目录 | 公开文件（头像、公告图片）直链访问 |

示例：

```nginx
server {
  listen 443 ssl;
  server_name admin.example.com;
  root /srv/qiwu/apps/web/dist;

  location / {
    try_files $uri /index.html;
    add_header Content-Security-Policy "…与 SPA_CSP 一致…" always;
    add_header X-Content-Type-Options nosniff always;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # 覆盖，不要追加
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location /files/ {
    alias /srv/qiwu/apps/server/data/upload/public/;
    add_header X-Content-Type-Options nosniff always;
  }
}
```

**要点：**

- `X-Forwarded-For` 要用 `$remote_addr` **覆盖**，不能追加客户端传来的值，否则 IP 黑名单、限流都可能被绕过。
- 前端的内容安全策略（CSP）只在 `apps/web/csp.ts` 中定义一处，nginx 下发的值必须和它完全一致。打印当前值的命令：

  ```bash
  node -e "import('./apps/web/csp.ts').then((m) => console.log(m.SPA_CSP))"
  ```

- 私有目录 `upload/private/` 永远不要做静态映射，私有文件只能通过鉴权接口下载。

## 使用 S3 存储时

如果在 **系统工具 → 文件配置** 里启用了 S3（阿里云 OSS、腾讯云 COS、Cloudflare R2、MinIO 等兼容服务）并开启了浏览器直传：

1. 构建前端时，用 `CSP_CONNECT_SRC` 声明 S3 的地址：

   ```bash
   CSP_CONNECT_SRC=https://bucket.s3.example.com pnpm --filter @qiwu/web build
   ```

2. 存储桶的 CORS 规则要允许本站源的 `PUT` 和 `GET` 请求。
3. 给 `staging/` 目录设置一条生命周期规则（比如 1 天后过期），用来清理上传了但没有确认的文件。
4. 自建服务如果用了非标准端口（比如 MinIO 的 9000），要在服务端环境变量中登记：`OUTBOUND_S3_PORTS=9000`。

## 单实例说明

v1 按**单实例**设计：限流计数存在进程内存中，实时推送也没有跨实例广播。需要多实例部署时，要加上 Socket.IO 的 Redis 适配器，并把限流改为 Redis 存储。
