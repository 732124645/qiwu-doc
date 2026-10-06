---
description: '把栖梧部署到生产服务器：构建与生产环境变量、迁移和种子数据、nginx 反向代理与 CSP、PM2 守护进程、S3 存储、OAuth2、演示模式和多实例部署要求。'
---

# 部署

::: info
目前的部署方式是**编译产物 + 反向代理**，可以选用 PM2 守护进程。Docker 镜像和 docker-compose 方案会在以后的版本中提供。
:::

## 构建

服务器需要 Node.js 22（不低于 22.22.1）、pnpm 11（仓库固定 11.28.3）、MySQL 8.4 及以上、Redis 7.0 及以上。在仓库根目录执行：

```bash
pnpm i --frozen-lockfile
pnpm -r build
```

产物位置：

- 服务端：`apps/server/dist/`，工作目录为 `apps/server`，启动方法见下面的[启动](#启动)
- 前端：`apps/web/dist/`，纯静态文件，由反向代理托管

部署时保留整个仓库目录（下面的例子放在 `/srv/qiwu/current`，包括 `apps/server/dist/`、`packages/shared/dist/` 和安装好的依赖），不要只复制 `dist/main.js`。数据库、上传目录和密钥文件要单独备份，它们不随构建产物替换。

## 生产环境变量

在服务器上至少设置这些项。普通配置写在 `apps/server/.env`，账号和密钥写在 `apps/server/.env.local`（不要两边都写，同一个变量以 `.env` 为准，见[环境变量](/reference/env)）。也可以全部用进程环境变量，它的优先级最高：

```ini
# apps/server/.env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_HOST=…
DB_NAME=…
REDIS_HOST=…
REDIS_DB=…                      # 先确认这个库号空闲，不要和开发、测试、演示环境共用
TRUST_PROXY=反向代理的地址      # 不要填整个内网网段
CORS_ORIGIN=https://admin.example.com
SWAGGER_ENABLED=false           # 生产环境建议关闭接口文档
CODEGEN_WRITE=false
APP_DEMO_MODE=false
STORAGE_LOCAL_ROOT=/srv/qiwu/uploads

# apps/server/.env.local
APP_SECRET=至少32位随机字符串    # 泄露后要更换，更换后已加密的第三方密钥无法解密
DB_USER=…
DB_PASSWORD=…
REDIS_USERNAME=…
REDIS_PASSWORD=…
```

- 不要复制开发或测试环境的密钥。`NODE_ENV=production` 时，如果 `APP_SECRET` 或 `SEED_ADMIN_PASSWORD` 里含有 `not-for-production`（测试配置专用的标记，不区分大小写），服务启动、`db:migrate` 和 `db:seed` 都会直接报错退出。
- `.env.local` 只给部署用户读写（Linux 上设为 `600`）。部署用户还要能写上传目录下的 `public/` 和 `private/`；nginx 只需要读 `public/`。

首次部署的数据初始化：

```bash
pnpm db:migrate    # 先执行迁移
pnpm db:seed       # 再写入种子数据
```

**先迁移，再写种子数据**。升级版本时也按这个顺序执行，执行前先备份数据库、上传文件和密钥。迁移和种子是发布步骤，只在发布时执行一次，不要写进每次启动的命令里。

::: danger
生产环境不要用 `db:reset`，它会删除所有表。（`NODE_ENV=production` 时这个命令本身也会拒绝执行。）
:::

::: warning 上线前处理示例账号
`db:seed` 会创建请假示例用的 5 个 OA 示例账号（`oa.employee`、`oa.supervisor` 等），它们共用一个只打印一次的随机密码。正式上线前，请停用或删除这些账号，或者移除请假示例；不要公开 seed 的输出。
:::

## 启动

必须先进入服务端目录再启动：

```bash
cd apps/server
node --env-file-if-exists=.env.local --env-file-if-exists=.env dist/main.js
```

多语言文案、迁移、代码生成模板、IP 数据和默认上传目录都按当前工作目录查找，所以不要在仓库根目录直接执行 `node apps/server/dist/main.js`。如果所有配置都由进程环境变量提供，在同一个目录执行 `node dist/main.js` 也可以。

启动后检查 `GET /api/health`、登录、文件上传和私有文件下载、实时推送是否正常。

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
  root /srv/qiwu/current/apps/web/dist;

  location / {
    try_files $uri /index.html;
    add_header Content-Security-Policy "…与 SPA_CSP 一致…" always;
    add_header X-Content-Type-Options nosniff always;
  }

  location /api/ {
    client_max_body_size 21m;                         # nginx 默认只有 1 MB
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;   # 覆盖，不要追加
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 75s;                           # 要比心跳间隔长
  }

  location /files/ {
    alias /srv/qiwu/uploads/public/;                  # STORAGE_LOCAL_ROOT 下的 public/
    autoindex off;
    add_header X-Content-Type-Options nosniff always;
    add_header Content-Security-Policy "default-src 'none'; sandbox" always;
  }
}
```

**要点：**

- `X-Forwarded-For` 要用 `$remote_addr` **覆盖**，不能追加客户端传来的值，否则 IP 黑名单、限流都可能被绕过。
- `Host`、`X-Forwarded-Host` 要保留浏览器访问时的地址（用 `$http_host`，非标准端口时端口号也要保留），`X-Forwarded-Proto` 要传入实际的协议。刷新登录状态和 WebSocket 连接都会按这些头校验请求来源；`TRUST_PROXY` 信任这个代理时，服务端以 `X-Forwarded-Host` 为准。
- `client_max_body_size` 要覆盖后台的上传大小上限（默认 20 MB）和 Excel 导入上限（默认 10 MB），再留一点余量。在 **参数设置** 里调大这两个上限（`storage.max_size_mb`、`excel.import_max_mb`）时，nginx 也要一起调大。
- 前端的内容安全策略（CSP）只在 `apps/web/csp.ts` 中定义一处，nginx 下发的值必须和它完全一致。打印当前值的命令：

  ```bash
  node -e "import('./apps/web/csp.ts').then((m) => console.log(m.SPA_CSP))"
  ```

- `/files/` 只能指向上传目录下的 `public/`，不能指向整个上传目录；私有目录 `private/` 永远不要做静态映射，私有文件只能通过鉴权接口下载。

## 使用 PM2 守护进程（可选）

PM2 是常用的 Node 进程管理工具，能在进程崩溃后自动重启、开机自启。它是 AGPL-3.0 协议，所以只在服务器上**全局安装**，不加进项目的依赖，也不在代码里引用它，不影响项目本身的 MIT 协议。

```bash
npm install -g pm2
```

在部署目录（例子里是 `/srv/qiwu/current`）新建 `ecosystem.config.cjs`。项目是 ESM，所以配置文件用 `.cjs` 后缀；`cwd` 必须是服务端目录的绝对路径：

```js
module.exports = {
  apps: [
    {
      name: 'qiwu-server',
      cwd: '/srv/qiwu/current/apps/server',
      script: 'dist/main.js',
      node_args: '--env-file-if-exists=.env.local --env-file-if-exists=.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      time: true,
      error_file: '/srv/qiwu/logs/server-error.log',
      out_file: '/srv/qiwu/logs/server-out.log',
      env_production: { NODE_ENV: 'production' },
    },
  ],
}
```

配置文件里没有密钥，密钥仍然放在 `.env.local` 或进程环境变量里。先执行一次迁移和种子，再启动：

```bash
pm2 start /srv/qiwu/current/ecosystem.config.cjs --env production
pm2 logs qiwu-server     # 查看日志，按 Ctrl + C 退出
pm2 save                 # 保存当前进程列表
pm2 startup              # 打印开机自启的安装命令，核对后再执行
```

升级时按这个顺序：`pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → `pm2 restart qiwu-server`。迁移和种子命令会重新编译服务端，删除并重建正在运行的 `apps/server/dist/`；想避开新旧版本短暂并存的这段时间，先 `pm2 stop qiwu-server` 再执行这些步骤。

要用 PM2 启动多个实例（`instances` 大于 1），先满足[多实例部署](#多实例部署)的条件。

## 使用 S3 存储时

如果在 **系统管理 → 文件管理 → 存储配置** 里启用了 S3（阿里云 OSS、腾讯云 COS、Cloudflare R2、MinIO 等兼容服务），不管有没有开启浏览器直传，都要做下面的设置。存在 S3 上的私有文件，下载和预览都由浏览器跟随跳转，直接从 S3 读取（60 秒有效的临时链接）：

1. 构建前端和打印 CSP 时，都用 `CSP_CONNECT_SRC` 声明 S3 的地址，再把打印出的值填进 nginx 的 `Content-Security-Policy`（构建产物里不含 CSP，浏览器只认 nginx 下发的这一份）：

   ::: code-group

   ```bash [macOS]
   CSP_CONNECT_SRC=https://bucket.s3.example.com pnpm --filter @qiwu/web build
   CSP_CONNECT_SRC=https://bucket.s3.example.com node -e "import('./apps/web/csp.ts').then((m) => console.log(m.SPA_CSP))"
   ```

   ```powershell [Windows（PowerShell）]
   $env:CSP_CONNECT_SRC = "https://bucket.s3.example.com"
   pnpm --filter @qiwu/web build
   node -e "import('./apps/web/csp.ts').then((m) => console.log(m.SPA_CSP))"
   Remove-Item Env:CSP_CONNECT_SRC
   ```

   :::

2. 存储桶的 CORS 规则要允许本站源的 `PUT` 和 `GET` 请求。
3. 给 `staging/` 目录设置一条生命周期规则（比如 1 天后过期），用来清理上传了但没有确认的文件。
4. 自建服务如果用了非标准端口（比如 MinIO 的 9000），要在服务端环境变量中登记：`OUTBOUND_S3_PORTS=9000`。

## OAuth2 与单点登录

要让第三方系统通过[单点登录（OAuth2）](/features/oauth)接入时，部署上要注意两点：

1. **`/sso` 要回退到 `index.html`**。授权同意页 `/sso` 是前端页面，第三方会把用户的浏览器直接带到 `https://<后台域名>/sso?…`。上面 nginx 示例里 `location /` 的这一行已经包含它，不用另外配置：

   ```nginx
   try_files $uri /index.html;
   ```

   如果你的配置只对部分路径做回退，要把 `/sso` 加上，否则用户打开授权链接会看到 404。

2. **`TRUST_PROXY` 要设对**。这几个接口按来源 IP 限流，IP 取自 `TRUST_PROXY` 信任的代理传来的 `X-Forwarded-For`：

   | 接口 | 每个 IP 每分钟 |
   | --- | --- |
   | `GET` / `POST /api/oauth2/authorize`（同意页调用） | 各 120 次 |
   | `POST /api/oauth2/token` | 600 次 |
   | `POST /api/oauth2/introspect`、`/api/oauth2/revoke` | 各 1200 次 |

   默认值 `loopback` 只信任本机。nginx 和服务端在同一台机器上时不用改；反向代理或负载均衡在别的机器上时，要把 `TRUST_PROXY` 设成它的地址。设错了，所有用户和第三方都会算在代理这一个 IP 上，很快就会收到 429。

`/api/oauth2/token`、`/introspect`、`/revoke`、`/userinfo` 由第三方的后端直接调用，不需要配置跨域（CORS）。第三方登记的回调地址在生产环境必须是 `https://`。接入步骤见 [OAuth2 接入指南](/reference/oauth2)。

## 演示模式

公开演示站用 `APP_DEMO_MODE=true`，并且使用独立的数据库、Redis 库号和密钥，不要和正式环境共用。演示模式下：

- 所有 `GET` 请求照常；登录、退出、刷新登录状态、锁屏解锁、验证码校验、切换语言、保存表格列设置、公告和站内信标为已读等少数写操作允许执行；
- 其他写操作一律返回 403，提示“演示模式下不能执行此操作”，超级管理员和无需登录的接口也一样；
- OAuth2 的授权、令牌、校验、撤销接口和实时推送示例的“发送”也被拒绝。要演示单点登录，请用一套非演示的安装；
- 在线用户、登录日志、操作日志、API 访问日志和错误日志的页面和导出文件里，访客的 IP 和浏览器信息会脱敏显示，数据库里保存的原始记录不变；
- 锁屏界面连续输错密码达到上限时，只让当前这次登录失效，不影响其他访客；
- 新建的种子管理员和 OA 示例账号首次登录不要求修改密码。

把开关改回 `false`，已经公开的密码不会自动失效。正式环境请重新安装，不要沿用演示站的数据库。

<span id="单实例说明"></span>

## 多实例部署

服务端可以同时运行多个实例（多个进程或多台机器），前面用反向代理分流：

- **实时推送**：通过 Socket.IO 的 Redis 适配器跨实例转发，推送、在线人数统计和强制下线在所有实例上都生效；
- **限流**：计数存在 Redis 里，所有实例共同累计。Redis 出错时请求会返回错误，不会因为计数失败而放行。

启动多个实例前，要满足这些条件：

1. Redis 7.0 及以上，账号允许分片订阅（`SSUBSCRIBE`、`SPUBLISH`、`PUBSUB SHARDNUMSUB`）和限流用到的 `EVAL`、`TIME` 等命令；
2. 同一套部署的所有实例连接同一个 MySQL 库、同一个 Redis，`REDIS_DB`、`REDIS_KEY_PREFIX`、`APP_SECRET` 和其他配置都相同，运行同一个版本；
3. 不同的部署（比如测试环境和正式环境）使用不同的 Redis 库号，库号相同就会互相收到对方的推送；
4. 用本地文件存储时，所有实例要访问同一个共享目录，nginx 的 `/files/` 也指向它；跨机器部署建议改用 S3 存储；
5. 反向代理把 `/socket.io/` 的 WebSocket 连接转发到所有实例。项目只使用 WebSocket，**不需要粘性会话**；`TRUST_PROXY` 只填实际的代理地址。

每个实例会额外占用两条 Redis 连接，部署时留出余量。迁移和种子仍然只在发布时执行一次，不要每个实例启动时都执行。

几点限制：

- 实时推送不保证一定送达，断线重连期间的消息可能丢失。重要数据要先存进数据库，客户端重连后通过接口重新获取；
- 限流和分布式锁按单个 Redis 节点设计，不支持 Redis Cluster；Redis 故障切换时，锁可能被重复获取；
- 万一某个实例漏收了强制下线的通知，每个实例每 60 秒还会复查一次本机连接的登录状态；
- 模板只在同一台机器上用两个进程测试过，多台机器的网络、负载均衡、共享存储和生产容量需要部署时自己验证。
