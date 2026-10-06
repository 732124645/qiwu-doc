---
description: '在本机 10 分钟跑起栖梧：Node.js、pnpm、MySQL 和 Redis 的版本要求，建库、配置 .env.local、初始化数据库并启动，再用新项目脚本创建自己的项目。'
---

# 快速开始

目标：10 分钟内在本机跑起来。

本页是教程版，命令以仓库的[入门指南](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md)为准；那里还有隔离测试库、Redis ACL 用户、cmd 入口等完整说明。

::: tip 要开始自己的项目？
本页带你把模板本身跑起来。准备在模板上开发自己的业务系统时，推荐用仓库自带的新项目脚本初始化，让新项目使用自己的数据库、Redis 库号和密钥，见[创建自己的项目](#创建自己的项目)。
:::

## 环境要求

| 软件 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22.22.1 | 推荐 22 LTS |
| pnpm | 11.28.3 | 用 `npm install -g pnpm@11.28.3` 安装，和仓库 `packageManager` 一致 |
| MySQL | 推荐 8.4（自动测试使用的版本） | 单数据源 |
| Redis | 7.0 及以上 | 登录会话和实时推送用到 Redis 7 才有的命令；ACL 用户需要的命令见[仓库入门指南第 2 节](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#2-空库账号与隔离)；Windows 推荐 Memurai 4.x 或以上 |

::: tip macOS
用 Homebrew 安装最简单：`brew install mysql redis`，再分别用 `brew services start mysql`、`brew services start redis` 启动服务。
:::

::: tip Windows
推荐在 Windows 终端或 VS Code 的终端里使用自带的 Windows PowerShell 5.1，开发和全部检查命令都已在 Windows 11 上验证过。先按[安装环境（Windows）](/beginner/install-windows)安装 Git、Node.js、MySQL、Memurai，并完成“允许运行脚本”后安装 pnpm。MySQL 和 Memurai 的启动、停止在“服务”（`services.msc`）里操作，服务名以安装时的实际名称为准。不想修改执行策略时，照仓库的做法用 `npm.cmd` / `pnpm.cmd`，见[仓库入门指南](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#windows原生-powershell-51)。
:::

## 1. 获取代码

```bash
git clone https://github.com/732124645/qiwu-vue-admin.git
cd qiwu-vue-admin
```

## 2. 准备数据库和 Redis

建一个开发库和一个专用账号：Windows 在 **MySQL Workbench** 中用 root 连接本地数据库，把下面的 SQL 粘贴到查询窗口执行；macOS 可以在 `mysql -u root -p` 登录后执行。成功后，Windows 在 Workbench 左侧 SCHEMAS 面板点刷新按钮，应该能看到 `qiwu_dev`；macOS 执行 `SHOW DATABASES;`，结果里应该有 `qiwu_dev`。

::: tip 为什么开发库叫 qiwu_dev
`db:reset` 会删掉库里所有的表再重建。为了防止误删正式数据，**只有库名以 `_dev`、`_test` 或 `_e2e` 结尾时**，它才会执行。这只是 `db:reset` 这一条命令的限制，服务本身、`db:migrate`、`db:seed` 都不检查库名，生产库可以随意命名。
:::


```sql
CREATE DATABASE qiwu_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'qiwu'@'localhost' IDENTIFIED BY '换成你的密码';
CREATE USER 'qiwu'@'127.0.0.1' IDENTIFIED BY '换成你的密码';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
```

Redis 的所有键都带 `qw:` 前缀，可以和其他项目共用一个 Redis。如果要限制权限，可以建一个只能访问 `qw:*` 键和 `qw:*` 频道的 ACL 用户（键写成 `~qw:*`，频道写成 `&qw:*`），不要给它 `FLUSHDB`、`KEYS`、`CONFIG` 这类管理命令。

仓库推荐给应用建专用 ACL 用户 `qiwu`。开发用 Redis 13 号库（`.env.example` 的默认值）。以后要跑测试，还要另建 `qiwu_test`、`qiwu_e2e` 等隔离库，各环境的库名、库号和端口见[仓库入门指南第 2 节](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#2-空库账号与隔离)。

## 3. 配置环境变量

服务端的配置分两个文件，**两个都不提交到 git**。在仓库根目录执行：

::: code-group

```bash [macOS]
cp apps/server/.env.example apps/server/.env    # 开发配置：端口、库名、Redis 库号……
touch apps/server/.env.local                    # 账号和密钥：数据库和 Redis 账号、APP_SECRET
```

```powershell [Windows（PowerShell）]
if (-not (Test-Path apps/server/.env)) { Copy-Item apps/server/.env.example apps/server/.env }
notepad apps/server/.env.local
```

:::

已经有 `.env` 时先核对内容，不要直接覆盖。

用编辑器打开 `apps/server/.env.local`（Windows 上 `notepad apps/server/.env.local` 会询问是否新建，选“是”），保存为 **UTF-8（不带 BOM）**；Windows 也可以用 VS Code。记事本另存为时选择“所有文件”，确认文件名是 `.env.local`，不是 `.env.local.txt`。不要用 Windows PowerShell 5.1 的 `>`、`Out-File` 或 `Set-Content` 写这类文件：`>` 和 `Out-File` 默认写成 UTF-16，整个文件都读不出来；`Set-Content` 默认用系统本地编码（中文 Windows 是 GBK），值里有中文等非 ASCII 字符就会乱码；加 `-Encoding UTF8` 又会带 BOM，第一行的变量可能读不出来。

在 `apps/server/.env.local` 里填写：

```ini
DB_USER=qiwu
DB_PASSWORD='换成你的密码'
REDIS_USERNAME=qiwu
REDIS_PASSWORD='换成 Redis ACL 用户的密码'
APP_SECRET='换成下面生成的密钥'
# 可选：不设置时，第一次 seed 随机生成管理员密码
# SEED_ADMIN_PASSWORD='换成符合密码规则的管理员密码'
```

本机 Redis 没设密码时，删掉 `REDIS_USERNAME`、`REDIS_PASSWORD` 两行；只设了密码、没有 ACL 用户时，只删 `REDIS_USERNAME` 一行。

`APP_SECRET` 可以用这条命令生成（macOS 和 PowerShell 相同），把输出复制到 `APP_SECRET=` 后面的引号里并保存；macOS 也可以用 `openssl rand -base64 48`：

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

macOS 上再执行 `chmod 600 apps/server/.env.local`。

::: warning 账号和密钥不要写进 `.env`
服务端先读 `.env`，再读 `.env.local`，两个文件里都有的变量**以 `.env` 为准**，空值（`KEY=`）也算。所以这些变量只写在 `.env.local`，在 `.env` 里写了，哪怕是空值，`.env.local` 里的值也不会生效。
:::

配置在启动时会校验，缺少或者格式不对的话，服务会直接拒绝启动，并提示是哪一项有问题。所有配置项见[环境变量](/reference/env)，带注释的完整清单是仓库的 [apps/server/.env.example](https://github.com/732124645/qiwu-vue-admin/blob/main/apps/server/.env.example)。

## 4. 初始化数据库

```bash
pnpm i                                 # 安装依赖
pnpm --filter @qiwu/shared build       # 先编译共享包，服务端依赖它的产物
pnpm db:migrate                        # 执行迁移，建表
pnpm db:seed                           # 写入种子数据
```

先 migrate 再 seed。执行结束时，终端会打印一行管理员密码：

```text
seed: admin password (shown once, must be changed at first sign-in): xxxxxxxx
```

**这个密码只显示一次**，请记下来。账号是 `admin`，首次登录时必须修改密码。想固定密码，在第一次 seed 之前在 `.env.local` 设置 `SEED_ADMIN_PASSWORD`，这时不打印密码，首次登录也不要求修改；重新执行 seed 不会再显示密码。

::: warning
`pnpm db:reset` 会删掉库里所有的表和视图再重建，不是安装或升级步骤，不要对已经在用的 `qiwu_dev` 执行；升级同样先 `pnpm db:migrate` 再 `pnpm db:seed`。
:::

## 5. 启动

```bash
pnpm dev
```

这条命令会同时启动三个进程：共享包编译监听、服务端（端口 3000）、前端 Vite（端口 5173）。打开 `http://localhost:5173`，用 `admin` 和上一步的密码登录即可。

![登录页](/screenshots/zh-login.webp)

![工作台首页](/screenshots/zh-home.webp)

改完代码可用 `pnpm verify` 做静态检查（lint、架构、类型、翻译、原创性、许可证）。完整检查 `pnpm ci:local` 会清空重建测试库，先按[仓库入门指南第 5 节](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#5-检查与后续使用)准备隔离测试库。

## 创建自己的项目

上面运行的是模板本身。开发自己的业务系统时，把模板克隆到新目录，用仓库自带的新项目脚本给它配置自己的库名、Redis 库号、密钥、管理员密码和系统名称（密钥和密码随机生成，写进 `.env.local`，不在终端显示）。脚本只改 `apps/server/.env`、`.env.local` 和前端两个 `.env.*` 文件，不建库、不配 Redis 账号、不启动服务。

先预览，再正式执行：

```bash
git clone --origin template https://github.com/732124645/qiwu-vue-admin.git my-admin
cd my-admin
node scripts/new-project.mjs --dry-run --name my-admin --db-name my_admin_dev --redis-db 0 --title '我的后台'
node scripts/new-project.mjs --name my-admin --db-name my_admin_dev --redis-db 0 --title '我的后台'
```

`--redis-db 0` 只是示例，先确认没有别的项目在用；9、13、14、15 留给模板，脚本会拒绝。`--db-name` 必须以 `_dev` 结尾。远端名 `template` 用来以后比较模板更新。完整参数和交互用法见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#3-交互或-cli-配置)。

脚本**不会**建库、配置 Redis 账号或启动服务。执行完后还要自己做这几件事：

1. 按[第 2 步](#_2-准备数据库和-redis)的方法创建脚本里的数据库（比如 `my_admin_dev`），并给数据库账号授权；
2. 在 `apps/server/.env.local` 里补上 `DB_USER`、`DB_PASSWORD`、`REDIS_USERNAME`、`REDIS_PASSWORD`；
3. 在仓库根目录依次执行：

   ```bash
   pnpm i
   pnpm --filter @qiwu/shared build
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```

登录账号是 `admin`，密码就是 `.env.local` 里 `SEED_ADMIN_PASSWORD` 的值，用它登录后不会被要求修改密码。相同参数可以重复执行脚本，已有的密钥会保留，不会被替换。

::: tip 和模板同时运行
新项目要换后端端口和 `CORS_ORIGIN`，分两个终端启动，做法见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#与模板同时运行)。
:::

## 可选：IP 归属地数据

登录日志和在线用户里的"地点"一列，需要一个大约 11 MB 的 IP 数据文件，这个文件不包含在仓库里：

```bash
node scripts/fetch-ip2region.mjs
```

下载后会校验 sha256，然后重启服务端即可生效。不下载也不影响使用，只是"地点"一列显示为空。代理下载和 sha256 固定见[仓库部署文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#ip-地理位置数据ip2region)。

## 常见问题

**启动时报 `APP_SECRET` 相关错误**
`.env.local` 里没有填，或者长度不够 32 位。也检查一下 `.env` 里有没有一行 `APP_SECRET=`，有的话删掉（见上面第 3 步）。

**`db:reset refused`**
库名不是以 `_dev`、`_test` 或 `_e2e` 结尾，或者设置了 `NODE_ENV=production`。

**`pnpm i` 报 `ERR_PNPM_IGNORED_BUILDS`**
新加的依赖有安装脚本，需要在 `pnpm-workspace.yaml` 的 `allowBuilds` 里登记，设为 `true`（允许执行）或者 `false`（不执行）。
