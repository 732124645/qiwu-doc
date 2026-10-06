---
description: 'Run the Qiwu NestJS and Vue 3 admin template locally on macOS or Windows: MySQL and Redis setup, env files, database seeding and the new project script.'
---

# Getting started

Goal: get it running on your machine in 10 minutes.

This page is the tutorial version; its commands follow the repository's [getting started guide](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md) (Chinese), which also covers isolated test databases, the Redis ACL user, the cmd entry point and more.

::: tip Starting your own project?
This page gets the template itself running. When you are ready to build your own business system on the template, we recommend initializing it with the new project script that ships with the repository, so the new project uses its own database, Redis database number and secrets. See [Create your own project](#create-your-own-project).
:::

## Requirements

| Software | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 22.22.1 | 22 LTS recommended |
| pnpm | 11.28.3 | Install with `npm install -g pnpm@11.28.3`, matching the repository's `packageManager` |
| MySQL | 8.4 recommended (the version the automated tests use) | Single data source |
| Redis | 7.0 or later | Sign-in sessions and realtime push use commands that only exist in Redis 7; for the commands the ACL user needs, see [section 2 of the repository's getting started guide](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#2-空库账号与隔离) (Chinese); on Windows, Memurai 4.x or later is recommended |

::: tip macOS
Homebrew is the easiest way: `brew install mysql redis`, then start the services with `brew services start mysql` and `brew services start redis`.
:::

::: tip Windows
Use the built-in Windows PowerShell 5.1 in Windows Terminal or the VS Code terminal; development and all check commands have been verified on Windows 11. First follow [Installing the development tools (Windows)](/beginner/install-windows) (Chinese) to install Git, Node.js, MySQL and Memurai, allow running scripts, and then install pnpm. Start and stop MySQL and Memurai in Services (`services.msc`); use the service names chosen at install time. If you would rather not change the execution policy, do as the repository does and use `npm.cmd` / `pnpm.cmd`; see [the repository's getting started guide](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#windows原生-powershell-51) (Chinese).
:::

## 1. Get the code

```bash
git clone https://github.com/732124645/qiwu-vue-admin.git
cd qiwu-vue-admin
```

## 2. Prepare the database and Redis

Create a development database and a dedicated account. On Windows, connect to the local database as root in **MySQL Workbench**, paste the SQL below into a query window and run it; on macOS, run it after signing in with `mysql -u root -p`. When it succeeds, on Windows click the refresh button of the SCHEMAS panel on the left of Workbench and you should see `qiwu_dev`; on macOS, run `SHOW DATABASES;` and the result should include `qiwu_dev`.

::: tip Why the development database is called qiwu_dev
`db:reset` drops every table in the database and rebuilds it. To prevent deleting real data by mistake, it only runs **when the database name ends in `_dev`, `_test` or `_e2e`**. This rule applies only to the `db:reset` command; the service itself, `db:migrate` and `db:seed` do not check the name, so a production database can be named anything.
:::


```sql
CREATE DATABASE qiwu_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'qiwu'@'localhost' IDENTIFIED BY 'your-password';
CREATE USER 'qiwu'@'127.0.0.1' IDENTIFIED BY 'your-password';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
```

Every Redis key has the `qw:` prefix, so you can share one Redis with other projects. To restrict access, create an ACL user that can only touch `qw:*` keys and `qw:*` channels (keys as `~qw:*`, channels as `&qw:*`), and do not give it admin commands such as `FLUSHDB`, `KEYS` or `CONFIG`.

The repository recommends a dedicated ACL user `qiwu` for the application. Development uses Redis database 13 (the default in `.env.example`). To run tests later you also need separate isolated databases such as `qiwu_test` and `qiwu_e2e`; for the database names, Redis database numbers and ports of each environment, see [section 2 of the repository's getting started guide](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#2-空库账号与隔离) (Chinese).

## 3. Configure environment variables

The server configuration is split across two files, and **neither is committed to git**. Run in the repository root:

::: code-group

```bash [macOS]
cp apps/server/.env.example apps/server/.env    # dev config: port, database name, Redis database number...
touch apps/server/.env.local                    # accounts and secrets: database and Redis accounts, APP_SECRET
```

```powershell [Windows (PowerShell)]
if (-not (Test-Path apps/server/.env)) { Copy-Item apps/server/.env.example apps/server/.env }
notepad apps/server/.env.local
```

:::

If you already have a `.env`, check its contents first instead of overwriting it.

Open `apps/server/.env.local` in an editor (on Windows, `notepad apps/server/.env.local` asks whether to create the file; choose "Yes") and save it as **UTF-8 (without BOM)**; on Windows you can also use VS Code. When using Save As in Notepad, choose "All files" and make sure the file name is `.env.local`, not `.env.local.txt`. Do not write these files with `>`, `Out-File` or `Set-Content` in Windows PowerShell 5.1: `>` and `Out-File` write UTF-16 by default, so the whole file cannot be read; `Set-Content` uses the system's local encoding by default (GBK on Chinese Windows), so values with Chinese or other non-ASCII characters get garbled; adding `-Encoding UTF8` writes a BOM, and the variable on the first line may then not be read.

Fill in `apps/server/.env.local`:

```ini
DB_USER=qiwu
DB_PASSWORD='your-password'
REDIS_USERNAME=qiwu
REDIS_PASSWORD='password-of-the-redis-acl-user'
APP_SECRET='the-secret-generated-below'
# Optional: when unset, the first seed generates a random admin password
# SEED_ADMIN_PASSWORD='an-admin-password-that-meets-the-password-rules'
```

If your local Redis has no password, delete the `REDIS_USERNAME` and `REDIS_PASSWORD` lines; if it has a password but no ACL user, delete only the `REDIS_USERNAME` line.

You can generate `APP_SECRET` with this command (the same on macOS and PowerShell). Paste its output inside the quotes after `APP_SECRET=` and save; on macOS you can also use `openssl rand -base64 48`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

On macOS, also run `chmod 600 apps/server/.env.local`.

::: warning Do not put accounts and secrets in `.env`
The server reads `.env` first and then `.env.local`. For a variable in both files, **`.env` wins**, even if it is empty (`KEY=`). So write these variables only in `.env.local`; if one appears in `.env`, even with an empty value, the value in `.env.local` is ignored.
:::

The configuration is validated at startup. If a value is missing or malformed, the service refuses to start and tells you which one is wrong. The full commented list of settings is the repository's [apps/server/.env.example](https://github.com/732124645/qiwu-vue-admin/blob/main/apps/server/.env.example).

## 4. Initialize the database

```bash
pnpm i                                 # install dependencies
pnpm --filter @qiwu/shared build       # build the shared package first; the server depends on its output
pnpm db:migrate                        # run migrations to create the tables
pnpm db:seed                           # write seed data
```

Migrate first, then seed. When it finishes, the terminal prints the admin password:

```text
seed: admin password (shown once, must be changed at first sign-in): xxxxxxxx
```

**This password is shown only once**, so write it down. The username is `admin`, and you must change the password at first sign-in. To use a fixed password, set `SEED_ADMIN_PASSWORD` in `.env.local` before the first seed; the password is then not printed and you are not asked to change it at first sign-in. Running seed again does not show the password again.

::: warning
`pnpm db:reset` drops every table and view in the database and rebuilds it. It is not an install or upgrade step, so do not run it on a `qiwu_dev` that is already in use; upgrades also run `pnpm db:migrate` and then `pnpm db:seed`.
:::

## 5. Start

```bash
pnpm dev
```

This command starts three processes at once: the shared package watcher, the server (port 3000) and the Vite frontend (port 5173). Open `http://localhost:5173` and sign in with `admin` and the password from the previous step.

![Sign-in page](/screenshots/en-login.webp)

![Workbench home page](/screenshots/en-home.webp)

After changing code, run `pnpm verify` for the static checks (lint, architecture, types, translations, originality, licenses). The full check `pnpm ci:local` empties and rebuilds the test databases, so first prepare the isolated test databases as in [section 5 of the repository's getting started guide](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#5-检查与后续使用) (Chinese).

## Create your own project

The steps above run the template itself. When you build your own business system, clone the template into a new directory and use the new project script that ships with the repository to give it its own database name, Redis database number, secrets, admin password and system name (the secrets and the password are generated randomly and written to `.env.local`, not shown in the terminal). The script changes only `apps/server/.env`, `.env.local` and the two frontend `.env.*` files; it does not create the database, configure Redis accounts or start the service.

Preview first, then run it for real:

```bash
git clone --origin template https://github.com/732124645/qiwu-vue-admin.git my-admin
cd my-admin
node scripts/new-project.mjs --dry-run --name my-admin --db-name my_admin_dev --redis-db 0 --title 'My Admin'
node scripts/new-project.mjs --name my-admin --db-name my_admin_dev --redis-db 0 --title 'My Admin'
```

`--redis-db 0` is only an example; first make sure no other project uses it. 9, 13, 14 and 15 are reserved for the template and the script rejects them. `--db-name` must end in `_dev`. The remote name `template` is for comparing template updates later. For all options and the interactive mode, see [the repository](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#3-交互或-cli-配置) (Chinese).

The script does **not** create the database, configure Redis accounts or start the service. After it runs, you still need to:

1. Create the database the script configured (for example `my_admin_dev`) as in [step 2](#_2-prepare-the-database-and-redis), and grant the database account access to it;
2. Add `DB_USER`, `DB_PASSWORD`, `REDIS_USERNAME` and `REDIS_PASSWORD` to `apps/server/.env.local`;
3. Run these in the repository root, in order:

   ```bash
   pnpm i
   pnpm --filter @qiwu/shared build
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```

The username is `admin` and the password is the value of `SEED_ADMIN_PASSWORD` in `.env.local`; signing in with it does not ask you to change the password. You can run the script again with the same options: existing secrets are kept, not replaced.

::: tip Running alongside the template
The new project needs a different server port and `CORS_ORIGIN`, and is started in two terminals; see [the repository](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#与模板同时运行) (Chinese).
:::

## Optional: IP geolocation data

The **Location** column in the sign-in log and online users needs an IP data file of about 11 MB, which is not included in the repository:

```bash
node scripts/fetch-ip2region.mjs
```

The download is checked against its sha256; restart the server and it takes effect. Without it everything still works; the **Location** column just stays empty. For downloading through a proxy and pinning the sha256, see [the repository's deployment guide](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#ip-地理位置数据ip2region) (Chinese).

## Troubleshooting

**`APP_SECRET` error at startup**
It is not set in `.env.local`, or it is shorter than 32 characters. Also check whether `.env` has an `APP_SECRET=` line; if it does, delete it (see step 3 above).

**`db:reset refused`**
The database name does not end in `_dev`, `_test` or `_e2e`, or `NODE_ENV=production` is set.

**`pnpm i` reports `ERR_PNPM_IGNORED_BUILDS`**
A newly added dependency has an install script. Register it under `allowBuilds` in `pnpm-workspace.yaml`, set to `true` (allow it to run) or `false` (do not run it).
