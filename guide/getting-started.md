# 快速开始

目标：10 分钟内在本机跑起来。

## 环境要求

| 软件 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22.22.1 | 推荐 22 LTS |
| pnpm | 11 | 仓库 `packageManager` 已固定版本，用 `corepack enable` 即可自动切换 |
| MySQL | 8.x | 单数据源 |
| Redis | 6 及以上 | 需要支持 ACL（用户名 + 密码） |

::: tip macOS
用 Homebrew 安装最简单：`brew install mysql redis`，再用 `brew services start mysql redis` 启动服务。
:::

## 1. 获取代码

```bash
git clone <仓库地址> my-admin
cd my-admin
pnpm i
```

## 2. 准备数据库和 Redis

建一个开发库和一个专用账号（库名必须以 `_dev`、`_test` 或 `_e2e` 结尾，`db:reset` 会检查这一点，防止误删生产库）：

```sql
CREATE DATABASE qiwu_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'qiwu'@'localhost' IDENTIFIED BY '换成你的密码';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
```

Redis 的所有键都带 `qw:` 前缀，可以和其他项目共用一个 Redis。如果要限制权限，可以建一个只能访问 `qw:*` 的 ACL 用户。

## 3. 配置环境变量

服务端的配置分两个文件，**两个都不提交到 git**：

```bash
cd apps/server
cp .env.example .env      # 普通配置：端口、库名、Redis 库号……
touch .env.local          # 密钥：数据库和 Redis 账号、APP_SECRET
```

在 `.env.local` 里填写：

```ini
DB_USER=qiwu
DB_PASSWORD=换成你的密码
REDIS_USERNAME=           # Redis 没有 ACL 用户时留空
REDIS_PASSWORD=
APP_SECRET=至少32位的随机字符串
```

`APP_SECRET` 可以用这条命令生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

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

**这个密码只显示一次**，请记下来。账号是 `admin`，首次登录时必须修改密码。如果想固定密码，可以在 `.env` 里设置 `SEED_ADMIN_PASSWORD`。

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
`.env.local` 里没有填，或者长度不够 32 位。

**`db:reset refused`**
库名不是以 `_dev`、`_test` 或 `_e2e` 结尾，或者设置了 `NODE_ENV=production`。

**`pnpm i` 报 `ERR_PNPM_IGNORED_BUILDS`**
新加的依赖有安装脚本，需要在 `pnpm-workspace.yaml` 的 `allowBuilds` 里登记，设为 `true`（允许执行）或者 `false`（不执行）。
