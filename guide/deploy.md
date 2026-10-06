---
description: '把栖梧部署到生产服务器：构建与生产环境变量、迁移和种子数据、nginx 反向代理与 CSP、PM2 集群模式、GitHub Actions 自动检查与自动部署、S3 存储、OAuth2、演示模式和多实例部署要求。'
---

# 部署

::: info
目前的部署方式是**编译产物 + 反向代理**，可以选用 PM2 守护进程。也可以用仓库自带的 GitHub Actions 工作流和部署脚本，推送版本标签后自动部署到 Linux 服务器，见 [GitHub Actions 自动部署](#github-actions-自动部署)。Docker 镜像和 docker-compose 方案会在以后的版本中提供。
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

部署时保留整个仓库目录（下面的例子放在 `/srv/qiwu/current`，包括 `apps/server/dist/`、`packages/shared/dist/` 和安装好的依赖），不要只复制 `dist/main.js`。用[自动部署](#github-actions-自动部署)时，`/srv/qiwu/current` 是指向当前版本目录的链接，由部署脚本维护。数据库、上传目录和密钥文件要单独备份，它们不随构建产物替换。

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

仓库自带 PM2 配置文件 `scripts/deploy/ecosystem.config.cjs`（项目是 ESM，所以配置文件用 `.cjs` 后缀）：

- 用 cluster（集群）模式启动 2 个 worker（工作进程），能用上多个 CPU 核；升级时逐个替换 worker，服务不中断；
- 工作目录是 `/srv/qiwu/current/apps/server`，两个 env 文件按绝对路径加载；
- 日志写到 `/srv/qiwu/logs/`；
- 根目录、进程名和 worker 数可以用环境变量调整：`QW_DEPLOY_ROOT`（默认 `/srv/qiwu`）、`QW_PM2_NAME`（默认 `qiwu-server`）、`QW_PM2_INSTANCES`（默认 `2`）。

这个配置文件要放在部署用户改不了的 `/opt/qiwu-deploy/bin/`，日志目录只让部署用户写。用下面的[自动部署](#github-actions-自动部署)时，准备脚本会做好这两件事；手动部署时由管理员执行（这里假设部署用户是 `qiwu`）：

```bash
sudo install -d -m 0755 /opt/qiwu-deploy/bin
sudo install -m 0644 /srv/qiwu/current/scripts/deploy/ecosystem.config.cjs /opt/qiwu-deploy/bin/
sudo install -d -o qiwu -g qiwu -m 0750 /srv/qiwu/logs
```

配置文件里没有密钥，密钥仍然放在 `.env.local` 或进程环境变量里。先执行一次迁移和种子，再以部署用户的身份启动：

```bash
pm2 start /opt/qiwu-deploy/bin/ecosystem.config.cjs --env production
pm2 logs qiwu-server     # 查看日志，按 Ctrl + C 退出
pm2 save                 # 保存当前进程列表
pm2 startup              # 打印开机自启的安装命令，核对后再执行
```

升级时按这个顺序：`pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → `pm2 startOrReload /opt/qiwu-deploy/bin/ecosystem.config.cjs --env production`。最后一步逐个替换 worker，服务不中断。在同一个目录里升级时，迁移和种子命令会重新编译服务端，删除并重建正在运行的 `apps/server/dist/`；想避开新旧版本短暂并存的这段时间，先 `pm2 stop qiwu-server`，执行完再启动。自动部署时每个版本在单独的目录里构建，不会删除正在运行的 `dist/`。

调整 worker 数：执行 `pm2 scale qiwu-server <数量>`，再执行 `pm2 save`。用了自动部署时，还要把 `/opt/qiwu-deploy/deploy.env` 里的 `QW_PM2_INSTANCES` 改成同一个数。部署后的健康检查要求实际的 worker 数不少于这个值，达不到时之后的每次部署都会失败（退出码 3）。

同一台机器上的 cluster 已经满足[多实例部署](#多实例部署)的大部分条件，见那一节。

## GitHub Actions 自动部署

模板仓库自带两个 GitHub Actions 工作流和一套服务器部署脚本（`scripts/deploy/`）。GitHub Actions 是 GitHub 自带的自动化服务；工作流（workflow）是写在 `.github/workflows/` 里、由 GitHub 自动执行的一组步骤。把模板放进你自己的 GitHub 仓库后，可以做到：

- 每次推送到 main 或提交合并请求（PR），自动运行完整检查。这叫 CI（持续集成）；
- 推送 `v1.2.0` 这样的版本标签后，自动创建 GitHub Release（发布页），再通过 SSH 部署到你的 Linux 服务器；
- 服务器上每个版本放在单独的目录里，切换时服务不中断；新版本不健康时，自动切回上一版本的代码。

这套做法是可选的，不用它时按前面几节手动部署即可。部署脚本只支持 Linux 和 bash。

::: warning 用之前先确认
- 服务器从 GitHub 下载源码时不带任何凭据，所以版本标签所在的仓库必须是**公开仓库**。私有仓库不能直接使用这套部署脚本。
- 自动切回只回代码，不回数据库，迁移要兼容上一版本，见下面的[注意事项](#注意事项)。
:::

### 两个工作流

**CI（`.github/workflows/ci.yml`）**：推送到 main、提交 PR 或在 Actions 页面手动触发时运行，运行在 GitHub 提供的 Ubuntu 24.04 机器上：

1. 安装 Node.js 22.22.1 和 `package.json` 里 `packageManager` 指定的 pnpm，安装依赖；
2. 安装 Playwright 自带的 Chromium 浏览器（`PW_CHANNEL=chromium`）。在自己电脑上运行时，默认仍然用 Edge；
3. 用 shellcheck 检查部署脚本 `scripts/deploy/*.sh`；
4. 启动 MySQL 8.4 和 Redis 8 两个服务容器（只在这次运行中存在的临时服务），新建 `qiwu_test`、`qiwu_e2e`、`qiwu_mobile_e2e` 三个库。账号密码每次随机生成；Redis 账号和生产环境一样，只能访问 `qw:` 开头的键；
5. 运行完整检查 `pnpm ci:local`，包括电脑端和移动端的浏览器测试。

一次完整运行要几十分钟，超过 90 分钟会被强制结束。失败时，Playwright 的测试结果会作为附件上传，保留 7 天。

**发布（`.github/workflows/release.yml`）**：推送 `vX.Y.Z` 格式的标签（比如 `v1.2.0`）时运行；`v1.2.0-rc.1` 这样的预发布标签不会触发。它不再重跑检查，而是按顺序做这几件事：

1. 校验标签：格式正确，指向的提交在 main 上，`CHANGELOG.md` 里有对应版本的一节（标题是 `## [1.2.0]` 这样的格式），而且内容不为空；
2. 确认这个提交在 main 上已经有一次成功的 CI 运行。只认推送到 main 触发的运行，PR、手动触发和其他分支的运行都不算；其中的检查作业 `gate` 必须真正运行并通过，被跳过的不算；
3. 用 `CHANGELOG.md` 里的那一节创建 GitHub Release；
4. 进入 GitHub 环境 `demo`。环境（environment）是 GitHub 仓库里的一项设置，可以指定审批人，并保存只给部署使用的机密（secret）。设置了审批人时，要等审批通过才继续；
5. 通过 SSH 登录服务器，把 `<标签> <提交号>` 交给服务器上的部署命令执行。

同一时间只运行一个部署，后来的排队等待；排队的只保留最新的一个，更早排队的会被取消。工作流用到的第三方 action 都按完整提交号固定版本。只有创建 Release 的作业能写仓库；部署作业的访问令牌没有任何权限，它只拿得到环境里的机密。Actions 日志里只有部署的步骤摘要（公开仓库的日志谁都能看），详细输出留在服务器上。

### 服务器上的目录

“部署用户”指运行服务的 Linux 用户，自动部署时默认叫 `qiwu`。

| 路径 | 属主 | 用途 |
| --- | --- | --- |
| `/opt/qiwu-deploy/bin/` | root | 部署脚本和 PM2 配置。部署用户改不了它们，也就改不了部署逻辑 |
| `/opt/qiwu-deploy/deploy.env` | root | 部署设置，不含密钥 |
| `/opt/qiwu-deploy/deploy.lock` | root（部署用户组可写） | 部署锁，保证同一时间只有一个部署 |
| `/opt/qiwu-deploy/authorized_keys` | root | 部署公钥。sshd 只从这里读取部署用户的公钥，部署用户自己加不了公钥 |
| `/srv/qiwu/releases/<标签>-<UTC 时间>/` | 部署用户 | 每次部署一个完整目录（源码、依赖和构建产物）。`REVISION` 文件记录标签和提交号 |
| `/srv/qiwu/current` | 部署用户 | 指向当前版本目录的链接，原子切换（一步完成，不会停在切换到一半的状态）。nginx 的 `root` 和 PM2 的工作目录都经过它 |
| `/srv/qiwu/shared/apps/server/.env`、`.env.local` | 部署用户 | 所有版本共用的 env 文件，链接进每个版本目录。`.env.local` 的权限是 `600` |
| `/srv/qiwu/shared/ip2region/` | 部署用户 | IP 地理位置数据，按文件哈希分别存放，切回旧版本时也有对应的文件 |
| `/srv/qiwu/logs/`、`/srv/qiwu/logs/deploy/` | 部署用户 | PM2 日志；每次部署的详细日志（保留 90 天） |
| `/srv/qiwu/backups/` | 部署用户 | 可选的迁移前数据库备份（保留 14 天） |

上传目录必须放在代码目录之外：`STORAGE_LOCAL_ROOT` 要写在共享的 env 文件（`shared/apps/server/.env` 或 `.env.local`）里，不能只用进程环境变量；值要是绝对路径，而且不能在 `current`、`releases` 或 `app` 之下，比如 `/srv/qiwu/uploads`。切换版本会换掉代码目录，清理旧版本时也会删除它，所以不满足这些要求时，部署脚本会拒绝继续。

### 准备服务器（只做一次）

只有准备服务器和更新部署脚本需要 root，之后的部署都以部署用户的身份运行。

**1. 先准备好这些：**

- 部署用户 `qiwu`。它要有自己独立的用户组，组里不能有别的用户（脚本会检查）；建议锁定它的密码，只用密钥登录：

  ```bash
  sudo useradd --create-home --user-group --shell /bin/bash qiwu
  sudo passwd -l qiwu
  ```

- Node.js 22（不低于 22.22.1）、pnpm 11、PM2，以及 `git`、`curl`、`tar`、`flock`、`timeout`。它们必须装在 `/usr/local/bin`、`/usr/bin` 这样的系统目录里（脚本会检查）：部署通过 SSH 运行，找不到 nvm 这类装在用户目录里的 Node。要在部署前备份数据库时，还需要 `mysqldump`。
- MySQL 库和账号、Redis 账号，要求和前面[生产环境变量](#生产环境变量)一节相同。
- 一对部署用的 SSH 密钥。在自己电脑上生成：

  ::: code-group

  ```bash [macOS]
  ssh-keygen -t ed25519 -N '' -C deploy -f deploy_key   # 生成私钥 deploy_key 和公钥 deploy_key.pub
  cat deploy_key.pub                                     # 显示公钥
  ```

  ```powershell [Windows（PowerShell）]
  ssh-keygen -t ed25519 -C deploy -f deploy_key   # 提示输入密码时直接按两次回车，部署密钥不设密码
  Get-Content deploy_key.pub                      # 显示公钥
  ```

  :::

  把公钥（一行文字）保存到服务器的 `/root/deploy_key.pub`。私钥稍后存进 GitHub。

**2. 下载部署脚本并运行准备脚本。** 以 root 身份把某个版本标签的源码下载到 root 拥有的新目录，再从那里运行：

```bash
sudo -i                                    # 下面都以 root 身份执行
REPO=my-org/my-admin                       # 换成你的仓库：<账号>/<仓库名>
TAG=vX.Y.Z                                 # 换成要用的版本标签
SHA=<这个标签的 40 位提交号>                 # 和 GitHub 上这个标签的提交核对
git ls-remote https://github.com/$REPO "refs/tags/$TAG^{}" "refs/tags/$TAG"
install -d -m 0700 /root/qiwu-kit-$TAG
curl -fsSL https://codeload.github.com/$REPO/tar.gz/$SHA |
  tar -xz --strip-components=1 --no-same-owner --no-same-permissions -C /root/qiwu-kit-$TAG
bash /root/qiwu-kit-$TAG/scripts/deploy/server-migrate-layout.sh --pubkey /root/deploy_key.pub
```

- `git ls-remote` 打印的提交号要等于 `SHA`。带 `^{}` 的那一行是附注标签实际指向的提交，有这一行时以它为准。
- **不要从 `/srv/qiwu/current` 或 `/srv/qiwu/releases/` 运行准备脚本**。那里部署用户可以写，拿到部署用户权限的代码可以先改掉脚本，等 root 运行时借机提权。脚本开头会检查自己所在的目录、每一级上级目录和每个脚本文件，属主不是 root，或者用户组、其他人可写时，拒绝运行。

**3. 核对部署设置。** 第一次运行时，脚本从模板生成 `/opt/qiwu-deploy/deploy.env` 然后停下。用编辑器（比如 `nano`）打开它，至少核对 `QW_REPO`（改成你的仓库）、`QW_APP_USER` 和 `QW_PM2_NAME`，再运行一次上面最后那条命令。

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `QW_REPO` | 必填 | 版本标签所在的公开仓库 `<账号>/<仓库名>` |
| `QW_DEPLOY_ROOT` | `/srv/qiwu` | 部署根目录。准备脚本第一次运行时按它的 `--root` 参数写入（不加时是 `/srv/qiwu`）。要换目录，每次运行准备脚本都加上 `--root <目录>`，不要只改这一项，否则准备脚本和部署脚本用的目录不一致 |
| `QW_APP_USER` | `qiwu` | 部署用户，脚本只以这个用户的身份运行 |
| `QW_PM2_NAME`、`QW_PM2_INSTANCES` | `qiwu-server`、`2` | PM2 进程名和 worker 数。已经在用 PM2 时，进程名要和正在运行的一致 |
| `QW_HEALTH_URL`、`QW_HEALTH_TRIES` | `http://127.0.0.1:3000/api/health`、`30` | 健康检查的地址和次数（每次间隔 2 秒） |
| `QW_KEEP_RELEASES` | `3` | 保留几个部署成功的版本（包括当前版本） |
| `QW_MIN_FREE_MB` | `3072` | 部署前至少要有的剩余磁盘空间（MB） |
| `QW_DEPLOY_SEED` | `1` | 迁移后执行种子。种子可以重复执行，新菜单和权限要靠它写入 |
| `QW_ASSET_CARRY_DAYS` | `14` | 旧版本的网页资源保留几天 |
| `QW_SHARED_LINKS` | `apps/server/.env apps/server/.env.local` | 从 `shared/` 链接进每个版本的文件 |
| `QW_DB_NAME`、`QW_DB_BACKUP_CNF` | 空 | 两个都设置时，迁移前用 `mysqldump` 备份数据库。后者是一个只有备份权限的 MySQL 账号的选项文件（权限 `600`） |
| `QW_MIGRATE_ENV` | 空 | 可选的 env 文件，提供有修改表结构权限的 `DB_USER` 和 `DB_PASSWORD`，只在迁移和种子时使用。这样服务自己的数据库账号可以只有读写数据的权限 |
| `QW_ALLOW_DOWNGRADE` | `0` | 默认拒绝部署比当前更低的版本 |
| `QW_BUILD_TIMEOUT` | `30m` | `pnpm i` 和 `pnpm -r build` 各自的时限 |
| `QW_MIGRATE_TIMEOUT` | `10m` | 迁移和种子各自的时限。等锁的表结构变更会挡住线上对这张表的查询，时限不要设得太长 |

第二次运行时，脚本依次完成下面几步。它可以重复运行，已经完成的步骤会跳过：

1. 把部署脚本和 PM2 配置装进 root 拥有的 `/opt/qiwu-deploy/bin/`；
2. 把 `/srv/qiwu` 设为 root 所有、部署用户组可写并带粘滞位（权限 `1775`：部署用户能新建自己的文件，但不能改名或删除 root 放在这里的文件），再以部署用户的身份建好上表中的目录；
3. 有旧的单目录安装时，把它迁到新布局（见下面的提示），并把 nginx 配置里的 `/srv/qiwu/app/` 改成 `/srv/qiwu/current/`。`nginx -t` 检查通过才重新加载 nginx，否则还原；
4. 配置 sshd：部署用户只能用 `/opt/qiwu-deploy/authorized_keys` 里的公钥登录，登录后只能运行部署命令，不能打开终端，也不能转发端口。`sshd -t` 和 `sshd -T` 核对通过才重新加载 sshd，否则删除这份配置并停下。sshd 配置里用了 `AllowUsers` 或 `AllowGroups` 时，脚本只打印警告，要自己把部署用户加进去，否则部署连不上服务器；
5. 已经有 PM2 进程时，把它从 fork（单进程）模式改成 cluster 模式。这是整个过程中唯一的停机，大约几秒；健康检查不通过时，恢复原来的进程列表；
6. 最后打印 GitHub 机密 `DEPLOY_KNOWN_HOSTS` 要用的服务器主机公钥。

**4. 准备共享的 env 文件和上传目录。** 新服务器上还没有这些文件，以部署用户的身份新建：

```bash
sudo -u qiwu -H mkdir -p /srv/qiwu/uploads/public /srv/qiwu/uploads/private
sudo -u qiwu -H touch /srv/qiwu/shared/apps/server/.env /srv/qiwu/shared/apps/server/.env.local
sudo -u qiwu -H chmod 600 /srv/qiwu/shared/apps/server/.env.local
```

内容按[生产环境变量](#生产环境变量)填写，`STORAGE_LOCAL_ROOT=/srv/qiwu/uploads`。nginx 按[反向代理](#反向代理-nginx)一节配置，`root` 指向 `/srv/qiwu/current/apps/web/dist`。

**5. 先手动部署一次。** 在服务器上部署一个标签，观察完整的流程，再去配置 GitHub：

```bash
sudo -u qiwu -H /opt/qiwu-deploy/bin/server-deploy.sh vX.Y.Z
```

第一次部署会执行迁移和种子，并启动 PM2。种子打印的一次性随机密码只写在服务器的部署日志里（`/srv/qiwu/logs/deploy/`），不会出现在 Actions 日志中。最后执行 `sudo -u qiwu -H pm2 startup`，核对它打印的命令后，以 root 身份执行那条命令，设置开机自启。

::: tip 已经有旧安装时
准备脚本会自动迁移旧的单目录安装 `/srv/qiwu/app`（PM2 以 fork 模式运行）：把 `.env`、`.env.local` 和 IP 数据复制到 `shared/`，把 `app` 移到 `releases/` 下作为第一个版本，建好 `current` 链接，再把 PM2 改成 cluster 模式。`app` 会留作指向 `current` 的链接；第一次自动部署成功、确认 nginx 配置不再引用它之后，就可以删掉。

如果仓库直接放在 `/srv/qiwu/current`（真实目录，不是链接），部署脚本会拒绝继续。可以先把它改名为 `/srv/qiwu/app`，再运行准备脚本，让脚本按旧安装迁移。这要求目录归部署用户所有，而且部署用户自己的 PM2 进程正在运行（以 root 或其他用户启动的 PM2 不算），上传目录也要满足[上面的要求](#服务器上的目录)；从改名到脚本完成的这段时间，页面会无法访问。
:::

以后某个版本改动了 `scripts/deploy/`，按第 2 步把新标签解压到新的 `/root/qiwu-kit-<标签>`，再运行一次准备脚本，就能更新 `/opt/qiwu-deploy/bin/`。

### 配置 GitHub 仓库

下面加粗的是 GitHub 英文界面上的名称。

1. **改工作流里的仓库名。** 两个工作流只在模板仓库里自动运行。把 `.github/workflows/ci.yml` 和 `.github/workflows/release.yml` 里的 `github.repository == '732124645/qiwu-vue-admin'` 都改成你的 `<账号>/<仓库名>`，提交并推送到 main。两个文件必须一起改：只改了 `release.yml` 时，CI 会跳过检查却显示成功，发布工作流发现检查作业被跳过，就会报错退出。
2. **新建环境 `demo`。** 打开 **Settings** → **Environments** → **New environment**，名称填 `demo`，点 **Configure environment**：
   - 要审批时，勾选 **Required reviewers** 并添加审批人（比如仓库所有者）。想批准自己发起的发布，就不要勾选 **Prevent self-review**。点 **Save protection rules** 保存；
   - **Deployment branches and tags** 选 **Selected branches and tags**，点 **Add deployment branch or tag rule**，**Ref type** 选 **Tag**，**Name pattern** 填 `v*`，点 **Add rule**。这样只有版本标签能部署；
   - 在 **Environment secrets** 下点 **Add environment secret**，依次添加下表的三个机密；
   - 部署用户不叫 `qiwu` 时，在 **Environment variables** 下点 **Add environment variable**，添加 `DEPLOY_USER`，值是部署用户名。

   | 机密 | 内容 |
   | --- | --- |
   | `DEPLOY_SSH_KEY` | 部署私钥 `deploy_key` 的全部内容 |
   | `DEPLOY_HOST` | 服务器地址。服务器前面有 CDN 时，填服务器自己的 IP，不要填经过 CDN 的域名 |
   | `DEPLOY_KNOWN_HOSTS` | 准备脚本最后打印的那一行，把开头的占位换成 `DEPLOY_HOST` 的值，两者要完全一致 |

   复制私钥，存进 GitHub 后删除电脑上的私钥：

   ::: code-group

   ```bash [macOS]
   pbcopy < deploy_key    # 私钥复制到剪贴板，粘贴到 DEPLOY_SSH_KEY
   rm deploy_key          # 保存好机密后删除
   ```

   ```powershell [Windows（PowerShell）]
   Get-Content deploy_key -Raw | Set-Clipboard   # 私钥复制到剪贴板，粘贴到 DEPLOY_SSH_KEY
   Remove-Item deploy_key                        # 保存好机密后删除
   ```

   :::

   环境名 `demo` 写在 `release.yml` 里。想换个名字（比如 `production`），同时改 `release.yml` 里的 `environment:`。

3. **保护版本标签。** 打开 **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New tag ruleset**。名称随意，**Enforcement status** 选 **Active**；在 **Target tags** 下点 **Add target** → **Include by pattern**，填 `v*`；勾选 **Restrict updates** 和 **Restrict deletions**，点 **Create**。这样发布过的标签不能被移动或删除。
4. **收紧 Actions 权限。** 打开 **Settings** → **Actions** → **General**：**Workflow permissions** 选 **Read repository contents and packages permissions**，取消勾选 **Allow GitHub Actions to create and approve pull requests**，点 **Save**。同一页里，把外部贡献者从复刻（fork）仓库发来的 PR 设为运行前需要审批。工作流只用 `pull_request` 触发，复刻仓库发来的 PR 拿不到机密。
5. **加固服务器的 SSH。** 部署从 GitHub 托管的运行机器连接服务器，它们的地址范围很大，所以 SSH 端口要对很大的范围开放。开放之前，先关闭密码登录，root 只允许用密钥登录。sshd 对同一项设置只采用最先读到的值。在 Debian/Ubuntu 上，`/etc/ssh/sshd_config.d/` 下的文件按文件名顺序先于主配置读入，云服务器镜像自带的 `00-*.conf` 之类的文件可能会重新打开密码登录。所以要以 `sshd -T` 显示的实际值为准：

   ```bash
   sudo sshd -T | grep -Ei '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin) '
   ```

   前两项要显示 `no`，`permitrootlogin` 不能是 `yes`。配置里有 `Match` 段时，它会覆盖这里显示的全局值，还要用 `sudo sshd -T -C user=root,host=<主机名>,addr=<外部地址>` 按具体连接核对。

   工作流用 SSH 默认的 22 端口连接。服务器的 SSH 改用了其他端口时，要在 `release.yml` 的 `ssh` 命令里加上 `-p <端口>`，`DEPLOY_KNOWN_HOSTS` 开头的地址也要写成 `[地址]:端口`。

### 发布一个版本

1. 在 `CHANGELOG.md` 里写好这个版本的一节，标题格式是 `## [1.2.0] - 2026-11-01`（版本号不带 `v`），内容不能为空；
2. 提交并推送到 main，在仓库的 **Actions** 页面等 CI 通过；
3. 在 main 的最新提交（就是刚推送、CI 已经通过的那个）上打标签并推送。这两条命令在 macOS 和 Windows 上相同：

   ```bash
   git tag -a v1.2.0 -m v1.2.0
   git push origin v1.2.0
   ```

4. 发布工作流创建 Release 后，等待审批：打开这次运行，点 **Review deployments**，勾选 `demo`，点 **Approve and deploy**；
5. 部署结果看这次运行的日志，详细输出在服务器的 `/srv/qiwu/logs/deploy/`。

::: warning 标签要打在 CI 测过的提交上
- CI 还在运行、失败了或者没有运行时，发布工作流会报错退出，不创建 Release，也不部署。等 CI 通过后，在 Actions 页面打开那次发布运行，点 **Re-run jobs** → **Re-run all jobs** 即可，校验在重新运行时进行。
- CI 偶尔失败时，先重新运行那次 CI，通过后再重新运行发布工作流。
- 一次推送多个提交时，只有最后一个提交有 CI 运行；提交信息带 `[skip ci]` 的推送没有 CI 运行。标签打在这些提交上，发布工作流重跑多少次都不会通过。
:::

### 每次部署做了什么

服务器上的强制命令只接受 `<vX.Y.Z> <40 位提交号>` 这样的输入，然后调用 `server-deploy.sh`：

1. 取得部署锁；已经有部署在运行时直接退出；
2. 在 `QW_REPO` 里查出标签指向的提交，必须和工作流发来的提交号一致。默认拒绝部署比当前更低的版本，并检查剩余磁盘空间；
3. 按提交号从 GitHub 下载源码包，解压到新目录 `releases/<标签>-<UTC 时间>`，链接共享的 env 文件和 IP 数据，然后执行 `pnpm i --frozen-lockfile` 和 `pnpm -r build`。构建以较低的优先级运行，把 CPU 让给正在运行的服务；
4. 把当前版本和最近 `QW_ASSET_CARRY_DAYS` 天（默认 14 天）的网页资源硬链接进新版本。这样已经打开的页面还能加载旧的文件，CDN 也不会缓存到 404；
5. 可选：先用 `mysqldump` 备份数据库。然后运行新版本的迁移和种子；
6. 原子切换 `current` 到新版本，用 `pm2 startOrReload` 逐个替换 worker，然后做健康检查：`/api/health` 要正常，而且每个 worker 都要在新版本的目录里运行。通过后清理多余的旧版本（默认保留 3 个）和过期的日志、备份。

安装、构建、迁移和种子都有时限（`QW_BUILD_TIMEOUT`、`QW_MIGRATE_TIMEOUT`），超时按失败处理，卡住的步骤不会一直占着部署锁。SSH 连接中断也不会打断部署，它会完成，或者切回上一版本。

脚本的退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 部署成功 |
| `1` | 切换前（或切换时）失败。新版本目录已删除，旧版本照常服务；新版本的迁移和种子可能已经执行，数据库不回退 |
| `2` | 切换后健康检查失败，已经切回上一版本 |
| `3` | 切回上一版本后仍然不健康，或者没有可以切回的版本（比如第一次部署），需要人工处理 |
| `64` | 参数错误，或者不是以部署用户的身份运行 |
| `75` | 已经有部署在运行 |

### 手动部署和切回

在服务器上执行：

```bash
sudo -u qiwu -H /opt/qiwu-deploy/bin/server-deploy.sh vX.Y.Z      # 手动部署一个标签
sudo -u qiwu -H /opt/qiwu-deploy/bin/server-deploy.sh --rollback  # 切回上一个部署成功的版本，只回代码
```

部署密钥只能部署标签，切回只能在服务器上执行。

### 注意事项

- **自动切回和 `--rollback` 只回代码，不回数据库。** 迁移要兼容上一版本的代码：先加后删，分两个版本完成。比如要删除一个字段，先发布一个不再使用它的版本，下一个版本再删。不兼容的迁移，在维护时间里手动部署，必要时用迁移前的备份恢复。MySQL 的表结构变更不能回滚，失败的迁移可能只执行了一部分。
- 部署从不执行 `db:reset`。种子可以重复执行，不会覆盖已有的密码。
- 迁移超时后，被结束的语句可能还在 MySQL 里等锁。用 `SHOW PROCESSLIST` 找到状态是 `Waiting for table metadata lock` 的迁移语句，用 `KILL` 结束它，再处理占着锁的长事务，然后重新部署。
- 部署进程卡住（比如被手动暂停）时，用 `pgrep -af server-deploy.sh` 找到它，结束它和它的子进程。进程退出后，部署锁会自动释放。
- CI 里的 MySQL 和 Redis 容器只用于测试，项目本身不提供 Docker 镜像。

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

在同一台机器上用 [PM2 的 cluster 模式](#使用-pm2-守护进程-可选)运行多个 worker 时，大部分条件已经满足：各 worker 读同一组 env 文件，连接同一个 MySQL 库和 Redis；上传目录是同一台机器上的同一个路径；项目只用 WebSocket，每条连接固定在一个 worker 上，不需要粘性会话；定时任务靠 Redis 锁避免重复执行。第 1 条的 Redis 版本和账号权限仍要自己确认。

几点限制：

- 实时推送不保证一定送达，断线重连期间的消息可能丢失。重要数据要先存进数据库，客户端重连后通过接口重新获取；
- 限流和分布式锁按单个 Redis 节点设计，不支持 Redis Cluster；Redis 故障切换时，锁可能被重复获取；
- 万一某个实例漏收了强制下线的通知，每个实例每 60 秒还会复查一次本机连接的登录状态；
- 模板只在同一台机器上用两个进程测试过，多台机器的网络、负载均衡、共享存储和生产容量需要部署时自己验证。
