---
description: '把栖梧部署到生产服务器的概览：构建、配置、迁移和启动，nginx、PM2、GitHub Actions 自动部署、S3、OAuth2、演示模式和多实例要点，细节见仓库部署文档。'
---

# 部署

::: info
目前的部署方式是**编译产物 + 反向代理**，可以选用 PM2 守护进程。也可以用仓库自带的 GitHub Actions 工作流和部署脚本，推送版本标签后自动部署到 Linux 服务器，见 [GitHub Actions 自动部署](#github-actions-自动部署)。Docker 镜像和 docker-compose 方案会在以后的版本中提供。完整、权威的步骤见仓库的[部署文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md)。
:::

## 构建

服务器需要 Node.js 22（不低于 22.22.1）、pnpm 11（仓库固定 11.28.3）、MySQL 8.4 及以上、Redis 7.0 及以上。在仓库根目录执行：

```bash
pnpm i --frozen-lockfile
pnpm -r build
```

服务端产物在 `apps/server/dist/`，从 `apps/server` 目录启动（见[启动](#启动)）；前端产物 `apps/web/dist/` 是静态文件，交给反向代理。保留整个仓库目录，不要只复制 `dist/main.js`；数据库、上传目录和密钥另外备份。Windows 上的构建和启动命令见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#windows构建与启动powershell-51)，Windows 服务器部署还没有验证。

## 生产环境变量

普通配置写 `apps/server/.env`（`NODE_ENV=production`、库名、Redis 库号、`TRUST_PROXY`、`CORS_ORIGIN`、`SWAGGER_ENABLED=false` 等），账号和密钥只写 `.env.local` 或进程环境，`.env` 里连空值也不写。不要复制开发或测试环境的密钥，生产环境会拒绝带 `not-for-production` 标记的密钥。Redis 库号先确认空闲，不和开发、测试、演示共用；`.env.local` 设为 `600`。示例见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#构建产物与环境)，各项含义见[环境变量](/reference/env)。

首次部署的数据初始化：

```bash
pnpm db:migrate    # 先执行迁移
pnpm db:seed       # 再写入种子数据
```

**先迁移，再写种子数据**，升级版本时也按这个顺序，执行前先备份数据库、上传文件和密钥。迁移和种子只在发布时执行一次，不要写进启动命令，见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#首次安装升级与启动)。

::: danger
生产环境不要用 `db:reset`，它会删除所有表。（`NODE_ENV=production` 时这个命令本身也会拒绝执行。）
:::

::: warning 上线前处理示例账号
`db:seed` 会创建请假示例用的 5 个 OA 示例账号（共用一个只打印一次的随机密码），正式上线前请停用或删除它们，或者移除请假示例，也不要公开 seed 的输出。
:::

## 启动

必须先进入服务端目录再启动：

```bash
cd apps/server
node --env-file-if-exists=.env.local --env-file-if-exists=.env dist/main.js
```

不要在仓库根直接执行 `node apps/server/dist/main.js`：翻译、迁移、生成模板和上传目录都按工作目录查找。

启动后检查 `GET /api/health`、登录、文件上传和私有文件下载、实时推送是否正常。

## 反向代理（nginx）

服务端只监听 `127.0.0.1`，由反向代理对外提供访问。需要配置这几个路径：

| 路径 | 转发到 | 说明 |
| --- | --- | --- |
| `/` | `apps/web/dist/` | SPA 页面，用 `try_files $uri /index.html` 处理前端路由 |
| `/api/` | `http://127.0.0.1:3000` | 接口 |
| `/socket.io/` | `http://127.0.0.1:3000` | WebSocket，需要设置 `Upgrade` 和 `Connection` 头 |
| `/files/` | 本地存储的 `public/` 目录 | 公开文件（头像、公告图片）直链访问 |

`X-Forwarded-For` 用 `$remote_addr` 覆盖，不能追加，否则 IP 黑名单和限流可能被绕过；`Host`、`X-Forwarded-Host`、`X-Forwarded-Proto` 保留浏览器访问的地址和协议，否则刷新登录和 WebSocket 会被拒绝。nginx 下发的 CSP 必须和 `apps/web/csp.ts` 完全一致，`client_max_body_size` 要覆盖上传上限，`/files/` 只能指向上传目录的 `public/`。完整配置见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#nginx-反向代理与-csp)。

## 使用 PM2 守护进程（可选）

PM2 能在崩溃后自动重启、开机自启。它是 AGPL-3.0 协议，只在服务器上全局安装（`npm install -g pm2`），不加进项目依赖。仓库自带 `scripts/deploy/ecosystem.config.cjs`（cluster 模式，2 个 worker）；先执行迁移和种子，再 `pm2 start`。安装位置、升级顺序和调整 worker 数见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#使用-pm2-部署可选)。同一台机器上的 cluster 已满足[多实例部署](#多实例部署)的大部分条件。

## GitHub Actions 自动部署

仓库自带两个 GitHub Actions 工作流（写在 `.github/workflows/` 里、由 GitHub 自动执行的一组步骤）和一套 Linux 部署脚本（`scripts/deploy/`），可以选用。推送到 main 或提交合并请求（PR）时运行完整检查（CI）；推送 `vX.Y.Z` 标签后，先确认这个提交的 CI 已经通过，再创建 GitHub Release，并经 SSH 部署到服务器。用在自己的仓库时，两个工作流里的仓库名要一起改。每个版本放在单独的目录里，切换时不停机；健康检查失败时自动切回上一版代码，数据库不回退，所以迁移要兼容上一版本。服务器下载源码时不带凭据，标签所在的仓库必须公开。

发布一个版本：在 `CHANGELOG.md` 写好 `## [1.2.0]` 一节，推送到 main 并等 CI 通过，再在这个提交上打标签：

```bash
git tag -a v1.2.0 -m v1.2.0
git push origin v1.2.0
```

细节见仓库：[仓库设置](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#仓库设置)、[服务器布局](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#服务器布局)、[服务器准备](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#服务器准备一次)、[每次部署](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#每次部署)、[边界](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#边界)。

## 使用 S3 存储时

在 **系统管理 → 文件管理 → 存储配置** 启用 S3 后，私有文件由浏览器直接从 S3 读取。所以要用 `CSP_CONNECT_SRC` 登记 S3 地址再构建前端，并让 nginx 下发同一份 CSP；存储桶配好 CORS（允许本站的 `PUT`、`GET`），给 `staging/` 设生命周期规则；非标准端口登记 `OUTBOUND_S3_PORTS`。命令见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#文件存储s3-直传与私有下载)。

## OAuth2 与单点登录

`/sso` 是前端路由，反向代理要把它回退到 `index.html`（上面的路径表已包含）；`TRUST_PROXY` 要设成反向代理的地址，否则授权和令牌接口的按 IP 限流全算在代理一个 IP 上；生产环境的回调地址必须是 `https://`。见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#oauth2-与单点登录)和 [OAuth2 接入指南](/reference/oauth2)。

## 演示模式

公开演示站设 `APP_DEMO_MODE=true`，使用独立的库、Redis 库号和密钥。除登录、退出、标为已读等少数操作外，写操作一律返回 403，超级管理员也一样；OAuth2 授权和令牌接口也被拒绝，要演示单点登录请用非演示安装；日志页面里访客的 IP 和浏览器信息脱敏显示。开关改回 `false` 不会让已公开的密码失效，正式环境请重新安装。放行清单见[仓库安全文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#演示模式的精确豁免)，另见[部署文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#演示模式与-oauth-边界)。

<span id="单实例说明"></span>

## 多实例部署

服务端可以运行多个实例，实时推送和限流经 Redis 共享。前提：Redis 7 及以上；同一部署的所有实例连同一个 MySQL 库和 Redis，`REDIS_DB`、`REDIS_KEY_PREFIX`、`APP_SECRET` 和程序版本都相同，不同部署用不同库号；本地文件放共享目录，跨机器建议用 S3。只用 WebSocket，不需要粘性会话；迁移和种子仍只在发布时执行一次。模板只在同一台机器上用两个进程测试过，完整条件和限制见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/scale-out.md#启动前置条件)。
