---
description: '服务端 .env、.env.local 的分工和加载顺序，账号密钥放哪里，以及主要环境变量概览；完整清单见仓库的 .env.example。'
---

# 环境变量

服务端配置在 `apps/server/` 下：

| 文件 | 是否提交 | 内容 |
| --- | --- | --- |
| `.env.example` | 提交 | 模板，复制为 `.env` 使用 |
| `.env` | 不提交 | 开发配置（端口、库名……），**不能写账号和密钥** |
| `.env.local` | 不提交 | **账号和密钥**：`DB_USER` `DB_PASSWORD` `REDIS_USERNAME` `REDIS_PASSWORD` `APP_SECRET` `SEED_ADMIN_PASSWORD` `WX_MP_APPID` `WX_MP_SECRET` |
| `.env.test` / `.env.e2e` | 提交 | 测试配置（只有测试专用的假密钥，不写数据库和 Redis 账号） |

加载顺序：先加载当前模式的文件（由 `ENV_FILE` 指定，默认 `.env`；服务端测试用 `.env.test`，Playwright 用 `.env.e2e`），再加载 `.env.local`；**同一个变量以先加载的文件为准**，空值也算，所以 `.env` 里已经写了（哪怕是 `KEY=`）的变量，放进 `.env.local` 不会生效。这就是账号和密钥只能写在 `.env.local` 的原因。进程中已经存在的环境变量优先于这两个文件。权威说明见[仓库入门指南第 3 节](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#3-配置与凭据)。

启动时所有配置都会经过校验，不合法就拒绝启动；生产环境拒绝带 `not-for-production` 标记的密钥（见[仓库安全文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#生产配置与凭据)）。每个变量的默认值和说明以 [apps/server/.env.example](https://github.com/732124645/qiwu-vue-admin/blob/main/apps/server/.env.example) 为准，校验规则见 [env.schema.ts](https://github.com/732124645/qiwu-vue-admin/blob/main/apps/server/src/core/config/env.schema.ts)。

## 服务

`NODE_ENV`、`PORT`、`HOST`（默认只监听 `127.0.0.1`）、`LOG_LEVEL` 写在 `.env`；`TRUST_PROXY` 只填真正的代理地址，不填整个内网网段；`CORS_ORIGIN` 列出本站以外额外允许的浏览器来源；`SWAGGER_ENABLED` 默认 `false`，`.env.example` 为开发打开了它，生产要关闭。

## 数据库与 Redis

地址、库名、库号写 `.env`，账号密码只写 `.env.local`（Redis 没有 ACL 用户时不写用户名，没设密码时也不写密码）；`REDIS_DB`（开发是 `13`）和 `REDIS_KEY_PREFIX`（默认 `qw:`）在同一部署的所有实例中必须相同，不同部署用不同库号。

## 安全

`APP_SECRET` 必填、只写 `.env.local`、至少 32 个字符，多实例时相同；它还用来派生加密第三方密钥的密钥，更换后已加密的第三方密钥无法解密。`ACCESS_TTL_SEC`、`REFRESH_TTL_SEC` 是令牌有效期（秒）；`ALLOW_PRIVATE_ENDPOINTS` 决定能否连接内网的 S3、SMTP，保持 `false`，自建 S3 或 SMTP 的非标准端口用 `OUTBOUND_S3_PORTS`、`OUTBOUND_SMTP_PORTS` 登记；`WX_MP_APPID`、`WX_MP_SECRET` 只写 `.env.local`。

`WX_MP_APPID`、`WX_MP_SECRET` 和参数 `auth.wx_mp.enabled` 都配置好之后，才能用微信小程序登录，见[登录与账号 · 微信小程序登录](/features/login#微信小程序登录)。生产环境的密钥要求见[仓库安全文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#生产配置与凭据)。

## 功能

`STORAGE_LOCAL_ROOT` 是本地存储根目录（默认 `./data/upload`）；`CODEGEN_WRITE` 决定生成器能否写仓库，只在开发环境生效；`APP_DEMO_MODE` 见[部署 · 演示模式](/guide/deploy#演示模式)；`SEED_ADMIN_PASSWORD` 只写 `.env.local`，第一次创建 `admin` 时使用，不设置时 `db:seed` 随机生成并只打印一次。

## 前端

前端的环境变量**不能放任何密钥**，因为它们会被打包进浏览器代码里。

`VITE_APP_TITLE` 是系统名称，显示在浏览器标签、侧栏和登录页，写在 `apps/web/.env.development` 和 `.env.production`；`CSP_CONNECT_SRC` 只在用 S3 时构建前端用，见[仓库部署文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#文件存储s3-直传与私有下载)；`API_PROXY_TARGET` 是启动 Vite 时的进程变量，不写进 `.env`，见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#与模板同时运行)。

前端请求接口固定走同源的 `/api`，没有单独的接口地址配置。

## 运行时参数

登录安全、密码策略、验证码模式、注册开关、日志保留天数、上传白名单和大小限制等，**不在环境变量里**，而是在后台的 **系统管理 → 参数设置** 中修改，改完立即生效。
