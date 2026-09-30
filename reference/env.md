# 环境变量

服务端配置在 `apps/server/` 下：

| 文件 | 是否提交 | 内容 |
| --- | --- | --- |
| `.env.example` | 提交 | 模板，复制为 `.env` 使用 |
| `.env` | 不提交 | 开发配置 |
| `.env.local` | 不提交 | **密钥**：数据库和 Redis 账号、`APP_SECRET` |
| `.env.test` / `.env.e2e` | 提交 | 测试配置（不含密钥） |

加载顺序：先加载当前模式的文件（默认 `.env`），再加载 `.env.local`；进程中已经存在的环境变量优先。启动时所有配置都会经过校验，不合法就拒绝启动。

## 服务

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` / `development` / `test` |
| `PORT` | `3000` | |
| `HOST` | `127.0.0.1` | 监听地址，由反向代理对外提供访问 |
| `TRUST_PROXY` | `loopback` | 反向代理的地址。**不要填整个内网网段** |
| `CORS_ORIGIN` | `http://localhost:5173` | 开发时前端的地址 |
| `LOG_LEVEL` | `info` | |
| `SWAGGER_ENABLED` | | 是否开放 `/api/docs`，生产环境建议关闭 |

## 数据库与 Redis

| 变量 | 说明 |
| --- | --- |
| `DB_HOST` `DB_PORT` `DB_NAME` | MySQL 连接 |
| `DB_USER` `DB_PASSWORD` | 放在 `.env.local` 中 |
| `REDIS_HOST` `REDIS_PORT` `REDIS_DB` | Redis 连接 |
| `REDIS_USERNAME` `REDIS_PASSWORD` | 放在 `.env.local` 中；没有 ACL 用户时留空 |
| `REDIS_KEY_PREFIX` | 默认 `qw:`，所有键都带这个前缀 |

## 安全

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_SECRET` | **必填** | 至少 32 个字符；用来派生第三方密钥的加密密钥 |
| `ACCESS_TTL_SEC` | `1800` | 访问令牌有效期（秒） |
| `REFRESH_TTL_SEC` | `604800` | 刷新令牌有效期（秒） |
| `ALLOW_PRIVATE_ENDPOINTS` | `false` | 是否允许连接内网的 S3/SMTP，只在测试时打开 |
| `OUTBOUND_S3_PORTS` | | S3 额外允许的端口，比如 `9000` |
| `OUTBOUND_SMTP_PORTS` | | SMTP 额外允许的端口 |

## 功能

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `STORAGE_LOCAL_ROOT` | `./data/upload` | 本地文件存储的根目录 |
| `CODEGEN_WRITE` | `false` | 是否允许代码生成器写入仓库（只在开发环境生效） |
| `APP_DEMO_MODE` | `false` | 演示模式：拒绝所有写操作 |
| `SEED_ADMIN_PASSWORD` | | 设置后 `admin` 使用这个密码；不设置时随机生成，并只打印一次 |

## 前端

前端的环境变量**不能放任何密钥**，因为它们会被打包进浏览器代码里。

| 变量 | 说明 |
| --- | --- |
| `VITE_APP_TITLE` | 页面标题 |
| `VITE_API_BASE` | 默认 `/api` |
| `CSP_CONNECT_SRC` | 构建时使用：内容安全策略额外允许的连接地址（比如 S3 直传地址） |

## 运行时参数

登录安全、密码策略、验证码模式、注册开关、日志保留天数、上传白名单和大小限制等，**不在环境变量里**，而是在后台的 **系统管理 → 参数设置** 中修改，改完立即生效。
