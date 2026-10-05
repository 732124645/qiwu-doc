# 环境变量

服务端配置在 `apps/server/` 下：

| 文件 | 是否提交 | 内容 |
| --- | --- | --- |
| `.env.example` | 提交 | 模板，复制为 `.env` 使用 |
| `.env` | 不提交 | 开发配置（端口、库名……），**不能写账号和密钥** |
| `.env.local` | 不提交 | **账号和密钥**：`DB_USER` `DB_PASSWORD` `REDIS_USERNAME` `REDIS_PASSWORD` `APP_SECRET` `SEED_ADMIN_PASSWORD` `WX_MP_APPID` `WX_MP_SECRET` |
| `.env.test` / `.env.e2e` | 提交 | 测试配置（只有测试专用的假密钥，不写数据库和 Redis 账号） |

加载顺序：先加载当前模式的文件（由 `ENV_FILE` 指定，默认 `.env`；服务端测试用 `.env.test`，Playwright 用 `.env.e2e`），再加载 `.env.local`；**同一个变量以先加载的文件为准**，空值也算，所以 `.env` 里已经写了（哪怕是 `KEY=`）的变量，放进 `.env.local` 不会生效。这就是账号和密钥只能写在 `.env.local` 的原因。进程中已经存在的环境变量优先于这两个文件。

启动时所有配置都会经过校验，不合法就拒绝启动。`NODE_ENV=production` 时，如果 `APP_SECRET` 或 `SEED_ADMIN_PASSWORD` 含有测试配置专用的标记 `not-for-production`（不区分大小写），服务启动、`db:migrate` 和 `db:seed` 都会报错退出，防止把测试密钥带到生产环境。

## 服务

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` / `development` / `test` |
| `PORT` | `3000` | |
| `HOST` | `127.0.0.1` | 监听地址，由反向代理对外提供访问 |
| `TRUST_PROXY` | `loopback` | 反向代理的地址。**不要填整个内网网段** |
| `CORS_ORIGIN` | | 除本站地址外，额外允许的浏览器来源（Origin），多个用逗号分隔；刷新登录状态和实时推送连接都按它校验请求来源（`.env.example` 里为开发设成了 `http://localhost:5173`）。服务端不开启跨域（CORS），浏览器统一通过同源的 `/api` 访问 |
| `LOG_LEVEL` | `info` | |
| `SWAGGER_ENABLED` | `false` | 是否开放 `/api/docs`（`.env.example` 里为开发设成了 `true`），生产环境建议关闭；关闭后“系统接口”菜单也不显示 |

## 数据库与 Redis

| 变量 | 说明 |
| --- | --- |
| `DB_HOST` `DB_PORT` `DB_NAME` | MySQL 连接 |
| `DB_USER` `DB_PASSWORD` | 放在 `.env.local` 中 |
| `REDIS_HOST` `REDIS_PORT` | Redis 连接 |
| `REDIS_DB` | Redis 库号，默认 `0`（`.env.example` 里是开发用的 `13`）。实时推送的频道名里带着库号，所以不同的部署要用不同的库号；同一套部署的多个实例必须相同 |
| `REDIS_USERNAME` `REDIS_PASSWORD` | 放在 `.env.local` 中；没有 ACL 用户时留空 |
| `REDIS_KEY_PREFIX` | 默认 `qw:`，所有键和频道都带这个前缀；同一套部署的多个实例必须相同 |

## 安全

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_SECRET` | **必填** | 写在 `.env.local`；至少 32 个字符；用来派生第三方密钥的加密密钥。多实例部署时所有实例必须相同 |
| `ACCESS_TTL_SEC` | `1800` | 访问令牌有效期（秒） |
| `REFRESH_TTL_SEC` | `604800` | 刷新令牌有效期（秒） |
| `ALLOW_PRIVATE_ENDPOINTS` | `false` | 是否允许连接内网的 S3/SMTP，只在测试时打开 |
| `OUTBOUND_S3_PORTS` | | S3 额外允许的端口，比如 `9000` |
| `OUTBOUND_SMTP_PORTS` | | SMTP 额外允许的端口 |
| `WX_MP_APPID` | | 写在 `.env.local`；微信小程序的 AppID |
| `WX_MP_SECRET` | | 写在 `.env.local`；微信小程序的 AppSecret |

`WX_MP_APPID`、`WX_MP_SECRET` 和参数 `auth.wx_mp.enabled` 都配置好之后，才能用微信小程序登录，见[登录与账号 · 微信小程序登录](/features/login#微信小程序登录)。

## 功能

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `STORAGE_LOCAL_ROOT` | `./data/upload` | 本地文件存储的根目录 |
| `CODEGEN_WRITE` | `false` | 是否允许代码生成器写入仓库（只在开发环境生效） |
| `APP_DEMO_MODE` | `false` | 演示模式：除登录、退出、标为已读等少数操作外，拒绝所有写操作；新建的种子账号首次登录不要求改密。详见[部署 · 演示模式](/guide/deploy#演示模式) |
| `SEED_ADMIN_PASSWORD` | | 写在 `.env.local`；第一次创建 `admin` 时使用这个密码，不打印，首次登录也不要求修改。不设置时 `db:seed` 随机生成一个，只打印一次，首次登录必须修改。已有的 `admin` 不会被改密码 |

## 前端

前端的环境变量**不能放任何密钥**，因为它们会被打包进浏览器代码里。

| 变量 | 说明 |
| --- | --- |
| `VITE_APP_TITLE` | 系统名称，显示在浏览器标签、侧栏和登录页，写在 `apps/web/.env.development` 和 `apps/web/.env.production`（不含密钥，可以提交）。不设置时跟随界面语言，显示“栖梧管理系统”或“Qiwu Admin” |
| `CSP_CONNECT_SRC` | 构建前端、打印 nginx 的 CSP 时使用：内容安全策略额外允许的连接地址（比如 S3 的地址：浏览器直传和私有文件下载都要用到）。多个用空格或逗号分隔，每项必须是 `https://主机[:端口]`，开发时可以用 `http://localhost[:端口]` |
| `API_PROXY_TARGET` | 开发时 Vite 把 `/api` 转发到的后端地址，默认 `http://127.0.0.1:3000`。这是启动 Vite 时设置的进程环境变量，不写进 `.env` 文件 |

前端请求接口固定走同源的 `/api`，没有单独的接口地址配置。

## 运行时参数

登录安全、密码策略、验证码模式、注册开关、日志保留天数、上传白名单和大小限制等，**不在环境变量里**，而是在后台的 **系统管理 → 参数设置** 中修改，改完立即生效。
