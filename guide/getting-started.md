# 快速开始

目标：10 分钟内在本机跑起来。

## 环境要求

| 软件 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22.22.1 | 推荐 22 LTS |
| pnpm | 11 | 用 `npm install -g pnpm@11` 安装，仓库 `packageManager` 已固定版本 |
| MySQL | 8.4 及以上 | 单数据源 |
| Redis | 7.0 及以上 | 需要支持 ACL、`GETDEL` 和 `PEXPIRE` 的 `NX`/`XX`/`GT` 选项；Windows 推荐 Memurai 4.x 或以上 |

::: tip macOS
用 Homebrew 安装最简单：`brew install mysql redis`，再分别用 `brew services start mysql`、`brew services start redis` 启动服务。
:::

::: tip Windows
推荐在 Windows 终端或 VS Code 的终端里使用自带的 Windows PowerShell 5.1。先按[安装环境（Windows）](/beginner/install-windows)安装 Git、Node.js、MySQL、Memurai，并完成“允许运行脚本”后安装 pnpm。MySQL 和 Memurai 的启动、停止在“服务”（`services.msc`）里操作，服务名以安装时的实际名称为准。
:::

## 1. 获取代码

```bash
git clone https://github.com/732124645/qiwu-vue-admin.git my-admin
cd my-admin
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

Redis 的所有键都带 `qw:` 前缀，可以和其他项目共用一个 Redis。如果要限制权限，可以建一个只能访问 `qw:*` 的 ACL 用户。

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
