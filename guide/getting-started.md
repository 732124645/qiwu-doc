---
description: '在本机 10 分钟跑起栖梧：Node.js、pnpm、MySQL 和 Redis 的版本要求，建库、配置 .env.local、初始化数据库并启动，再用新项目脚本创建自己的项目。'
---

# 快速开始

目标：10 分钟内在本机跑起来。

::: tip 要开始自己的项目？
本页带你把模板本身跑起来。准备在模板上开发自己的业务系统时，推荐用仓库自带的新项目脚本初始化，让新项目使用自己的数据库、Redis 库号和密钥，见[创建自己的项目](#创建自己的项目)。
:::

## 环境要求

| 软件 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22.22.1 | 推荐 22 LTS |
| pnpm | 11 | 用 `npm install -g pnpm@11` 安装，仓库 `packageManager` 固定为 11.28.3 |
| MySQL | 8.4 及以上 | 单数据源 |
| Redis | 7.0 及以上 | 需要支持 ACL、`GETDEL`、`PEXPIRE` 的 `NX`/`XX`/`GT` 选项，以及实时推送用到的分片订阅（`SSUBSCRIBE`、`SPUBLISH`）；Windows 推荐 Memurai 4.x 或以上 |

::: tip macOS
用 Homebrew 安装最简单：`brew install mysql redis`，再分别用 `brew services start mysql`、`brew services start redis` 启动服务。
:::

::: tip Windows
推荐在 Windows 终端或 VS Code 的终端里使用自带的 Windows PowerShell 5.1，开发和全部检查命令都已在 Windows 11 上验证过。先按[安装环境（Windows）](/beginner/install-windows)安装 Git、Node.js、MySQL、Memurai，并完成“允许运行脚本”后安装 pnpm。MySQL 和 Memurai 的启动、停止在“服务”（`services.msc`）里操作，服务名以安装时的实际名称为准。
:::

## 1. 获取代码

```bash
git clone https://github.com/732124645/qiwu-vue-admin.git
cd qiwu-vue-admin
pnpm i
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

## 3. 配置环境变量

服务端的配置分两个文件，**两个都不提交到 git**：

```bash
cd apps/server
```

::: code-group

```bash [macOS]
cp .env.example .env      # 开发配置：端口、库名、Redis 库号……
touch .env.local          # 账号和密钥：数据库和 Redis 账号、APP_SECRET
```

```powershell [Windows（PowerShell）]
Copy-Item .env.example .env
notepad .env.local
```

:::

用编辑器打开 `.env.local`（Windows 上 `notepad .env.local` 会询问是否新建，选“是”），保存为 **UTF-8（不带 BOM）**；Windows 也可以用 VS Code。记事本另存为时选择“所有文件”，确认文件名是 `.env.local`，不是 `.env.local.txt`。不要用 Windows PowerShell 5.1 的 `>`、`Out-File` 或 `Set-Content` 写这类文件：`>` 和 `Out-File` 默认写成 UTF-16，整个文件都读不出来；`Set-Content` 默认用系统本地编码（中文 Windows 是 GBK），值里有中文等非 ASCII 字符就会乱码；加 `-Encoding UTF8` 又会带 BOM，第一行的变量可能读不出来。

在 `.env.local` 里填写：

```ini
DB_USER=qiwu
DB_PASSWORD=换成你的密码
REDIS_USERNAME=           # Redis 没有 ACL 用户时留空
REDIS_PASSWORD=
APP_SECRET=至少32位的随机字符串
```

`APP_SECRET` 可以用这条命令生成（macOS 和 PowerShell 相同），把输出的 43 个字符复制到 `.env.local` 的 `APP_SECRET=` 后面并保存：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

::: warning 账号和密钥不要写进 `.env`
服务端先读 `.env`，再读 `.env.local`，两个文件里都有的变量**以 `.env` 为准**，空值（`KEY=`）也算。所以这些变量只写在 `.env.local`，在 `.env` 里写了，哪怕是空值，`.env.local` 里的值也不会生效。
:::

配置在启动时会校验，缺少或者格式不对的话，服务会直接拒绝启动，并提示是哪一项有问题。所有配置项的含义见[环境变量](/reference/env)。

## 4. 初始化数据库

```bash
cd ../..                               # 回到仓库根目录
pnpm --filter @qiwu/shared build       # 先编译共享包，服务端依赖它的产物
pnpm db:reset                          # 清空开发库 → 执行迁移 → 写入种子数据
```

执行结束时，终端会打印一行管理员密码：

```text
seed: admin password (shown once, must be changed at first sign-in): xxxxxxxx
```

**这个密码只显示一次**，请记下来。账号是 `admin`，首次登录时必须修改密码。如果想固定密码，可以在 `.env.local` 里设置 `SEED_ADMIN_PASSWORD`。

::: warning
`db:reset` 会删除库里所有的表，只能用在开发和测试库上。已有数据的库请用 `pnpm db:migrate`（只执行新的迁移）和 `pnpm db:seed`（补种子数据）。
:::

## 5. 启动

```bash
pnpm dev
```

这条命令会同时启动三个进程：共享包编译监听、服务端（端口 3000）、前端 Vite（端口 5173）。打开 `http://localhost:5173`，用 `admin` 和上一步的密码登录即可。

![登录页](/screenshots/zh-login.webp)

![工作台首页](/screenshots/zh-home.webp)

## 创建自己的项目

上面的步骤运行的是模板本身（开发库 `qiwu_dev`）。在模板上开发自己的业务系统时，推荐把模板克隆到一个新目录，再用仓库自带的**新项目脚本**完成初始配置，这样新项目有自己的数据库、Redis 库号和密钥，不会和模板混在一起。

脚本只用 Node 自带的功能，只改下面 4 个文件，不改包名、表前缀和业务代码：

| 文件 | 写入的内容 |
| --- | --- |
| `apps/server/.env` | `DB_NAME`、`REDIS_DB`（文件不存在时先从 `.env.example` 复制） |
| `apps/server/.env.local` | 缺少的 `APP_SECRET` 和管理员密码 `SEED_ADMIN_PASSWORD`（随机生成，不在终端显示） |
| `apps/web/.env.development`、`apps/web/.env.production` | 系统名称 `VITE_APP_TITLE` |

先预览，再正式执行：

```bash
git clone https://github.com/732124645/qiwu-vue-admin.git my-admin
cd my-admin
node scripts/new-project.mjs --dry-run --name my-admin            # 只预览，不写任何文件
node scripts/new-project.mjs --name my-admin --redis-db 0 --title "我的后台"
```

也可以直接执行 `node scripts/new-project.mjs`，按提示逐项输入。主要参数：

| 参数 | 说明 |
| --- | --- |
| `--name` | 项目名，小写字母开头，只能有小写字母、数字和 `-` |
| `--db-name` | 数据库名，默认把项目名的 `-` 换成 `_` 再加 `_dev`（例如 `my_admin_dev`）；必须以 `_dev` 结尾，不能用 `qiwu_dev` |
| `--redis-db` | Redis 库号；4～15 留给模板开发和测试，不能用。脚本不检查这个库是否空闲，要自己确认没有别的项目在用 |
| `--title` | 系统名称，显示在浏览器标签、侧栏和登录页；默认用项目名 |
| `--dry-run` | 只预览，不写文件 |

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
脚本不改端口。如果同一台电脑上模板也在运行，要在新项目的 `apps/server/.env` 里换一个空闲的 `PORT`（比如 `3310`），并把 `CORS_ORIGIN` 改成新前端的地址（比如 `http://localhost:5190`）。然后分两个终端启动：第一个终端执行 `pnpm --filter @qiwu/shared --filter @qiwu/server --parallel dev`；第二个终端先把环境变量 `API_PROXY_TARGET` 设为 `http://127.0.0.1:3310`，再执行 `pnpm --filter @qiwu/web dev --port 5190 --strictPort`。不要用 `pnpm dev --port 5190`，这个参数会传给所有包，导致启动失败。
:::

## 可选：IP 归属地数据

登录日志和在线用户里的"地点"一列，需要一个大约 11 MB 的 IP 数据文件，这个文件不包含在仓库里：

```bash
node scripts/fetch-ip2region.mjs
```

下载后会校验 sha256，然后重启服务端即可生效。不下载也不影响使用，只是"地点"一列显示为空。

## 常见问题

**启动时报 `APP_SECRET` 相关错误**
`.env.local` 里没有填，或者长度不够 32 位。也检查一下 `.env` 里有没有一行 `APP_SECRET=`，有的话删掉（见上面第 3 步）。

**`db:reset refused`**
库名不是以 `_dev`、`_test` 或 `_e2e` 结尾，或者设置了 `NODE_ENV=production`。

**`pnpm i` 报 `ERR_PNPM_IGNORED_BUILDS`**
新加的依赖有安装脚本，需要在 `pnpm-workspace.yaml` 的 `allowBuilds` 里登记，设为 `true`（允许执行）或者 `false`（不执行）。
