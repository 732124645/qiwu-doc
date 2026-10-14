---
description: 'Qiwu release notes: version 1.1.0 adds multi-tenancy (one shared database with data isolated per tenant, tenants, tenant packages, platform staff entering a tenant) with notes on upgrading and turning it on; version 1.0.3 adds GitHub Actions checks, automated releases and a server deploy kit, plus fixes; version 1.0.0 covers permissions, workflow, code generation, the mobile app, deployment and known limitations.'
---

# Changelog

This page records the changes in each Qiwu release. For the current features and the status of each one, see [Introduction · Features at a glance](/en/guide/introduction#features-at-a-glance).

## 1.1.0 · 2026-10-14

Adds multi-tenancy. Multi-tenancy means one deployment serves many companies or organizations at once; each one is called a **tenant**, and no tenant can see another's data. All tenants share one MySQL database, and a `tenant_id` column on each row says which tenant it belongs to. Multi-tenancy is off by default; while it is off, the system behaves exactly like 1.0.x, and all data belongs to the built-in **default tenant** (code `default`, the platform that runs the system). For the feature, see [Multi-tenancy](/en/features/multi-tenancy); for the full description in the repository, see the [multi-tenancy docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/multi-tenancy.md) (Chinese).

Added:

- **Multi-tenancy switch**: the server environment variable `APP_MULTI_TENANT`, `false` by default, read only at startup. There is no switch in the UI; after changing it, restart every instance to complete the switch.
- **Data isolation**: every row that belongs to a tenant carries `tenant_id`. The ORM (the library that maps database tables to objects in code, here TypeORM) adds the tenant condition automatically when reading and writing; hand-written SQL must add the tenant condition itself, and check scripts and tests report it when it is missing.
- **Tenants** (a platform page): opens a tenant in one step, creating its root department, the built-in **Tenant administrator** role, process templates and the administrator account at the same time; the administrator's initial password is shown only once. You can set an expiry time, a user quota, several bound domains, a brand name and a logo, and disable, enable and reset the initial password. When a tenant is disabled or expires, its sessions end at once and its data is kept.
- **Tenant packages**: decide which menus a tenant can use, enforced by the server: a user's permissions are the intersection of their role grants and the package. For features outside the package, the API returns 404.
- **Sign-in per tenant**: the web, H5, the app and the mini program can all sign in with a tenant code; the web and H5 can also recognize the tenant by a bound domain, with no code to enter. When the code does not exist or the tenant is disabled or has expired, the response is exactly the same as for a wrong password, so nobody can use it to probe which codes exist. Lockout after failed sign-ins, SMS codes, password reset, OAuth consent and WeChat linking are all kept separate per tenant.
- **Platform staff entering a tenant**: platform staff with the **Enter tenant** permission can enter a tenant to investigate a problem, and must give a reason when entering. While inside, a banner stays at the top of the page, and they leave automatically after 2 hours; entering, leaving and every request while inside are audited.
- **Platform pages**: platform pages such as menus, dictionaries, parameters, storage configs, message templates, the code generator, scheduled tasks and system monitoring belong to the default tenant, and other tenants cannot see them. With the switch on, **API access log**, **API error log** and **Cache keys** can be used only by the platform's super administrator. The action log and the sign-in log show the tenant of whoever acted.
- **Code generation**: generated code carries the tenant column and `@TenantColumn()`, and the generated API tests include a case where accessing another tenant's data returns 404. For how to write tenant-aware business code, see the [repository docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/multi-tenancy.md#编写租户感知的项目代码) (Chinese).
- **Demo data**: when `APP_DEMO_MODE` and `APP_MULTI_TENANT` are both on, two sample tenants are created, each with its own package and brand.

Changed:

- New tables are tenant tables by default. Platform tables shared by all tenants must be registered in `PLATFORM_TABLES`, and unique keys that must stay unique across all tenants in `GLOBAL_UNIQUE` (both in `apps/server/src/core/db/tenant-tables.ts`).

Upgrade steps:

- This release's database migrations only add columns and indexes, and are compatible with the previous release's code. With the switch kept off, upgrading needs no downtime, and you can roll back to the previous release.
- Back up the database, uploaded files and secrets, then upgrade as usual: update to the v1.1.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart the service. See [Deployment](/guide/deploy) (Chinese).
- To turn multi-tenancy on: a new installation can turn it on from the start; an existing database needs **two deployments**. The first keeps the switch off and upgrades to 1.1.0; make sure every instance works. The second sets the switch to `true` and deploys again; this time `db:migrate` removes the default value of the tenant columns. If the default values have not been removed, a production service with the switch on refuses to start, so the two steps cannot be merged into one. Before turning it on, review which roles in the default tenant have platform menus: once it is on, these roles can still use platform pages that affect every tenant. For the steps, see [Deployment · Turning multi-tenancy on or off](/guide/deploy#打开或关闭多租户) (Chinese) and the repository's [deployment docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#打开多租户开关) (Chinese).
- Tenants cannot be deleted, only disabled or given an expiry time. Before turning the switch off, disable every tenant you no longer serve; see the repository's [Turning off the multi-tenancy switch](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#关闭多租户开关) (Chinese).

::: warning No going back to older versions once it is on
A database that has had the multi-tenancy switch on cannot go back to any version before 1.1.0, including the patch releases of the 1.0 series. Older code does not filter data by tenant, and its inserts fail because they do not write the tenant column.
:::

Known limitations:

- A WeChat account can be linked only to an account in one tenant;
- On the main domain, one browser can be signed in to only one tenant at a time;
- Changes to bound domains take effect within 60 seconds;
- After a package changes, every session reloads its permissions once.

## 1.0.3 · 2026-10-06

Adds automated checks, automated releases and a server deploy kit, plus a few fixes. Versions 1.0.1 and 1.0.2 were tagged, but their automated checks failed, so they were never released; their changes are included in 1.0.3.

Added:

- **Automated checks (CI)**: CI (continuous integration) means checks run automatically every time code is pushed. In the public repository, every push to the main branch and every pull request (PR) starts MySQL 8.4 and Redis 8 on GitHub Actions (GitHub's built-in automation service) and runs the full check `pnpm ci:local`, including the browser tests for the web and mobile apps. It can also be started by hand.
- **Automated releases**: pushing a version tag in the form `vX.Y.Z` (for example `v1.2.0`) first checks that the same commit has already passed CI on the main branch, then creates a GitHub release from that version's section in the template's `CHANGELOG.md`. After approval in the `demo` environment (a GitHub repository setting that can require reviewers before a deploy), it deploys the demo site over SSH.
- **Server deploy kit** (`scripts/deploy/`): each release goes into its own directory, and a `current` link switches to it in one step; the env files are shared by all releases; PM2 runs in cluster mode (several processes at once) and reloads them one by one, so the service stays up; after the switch a health check confirms the service answers, and on failure the previous release's code is switched back automatically (the database is not rolled back). The deploy SSH key can only run the deploy command. See [Deployment · GitHub Actions auto deploy](/guide/deploy#github-actions-自动部署) (Chinese).

Fixed:

- `pnpm ci:local` builds the shared package `@qiwu/shared` before `verify`, so the full check also passes on a fresh clone.
- Mobile app: the built-in texts of the wot-ui component library (such as input placeholders) appear in English in the English UI, also in the dev server and on the first screen after a restart.
- Mobile Workbench: long English subtitles wrap to the left of the header illustration instead of running under it.

Upgrade steps:

- This release has no new database migrations, and no dependency or env key changes;
- Back up the database, uploaded files and secrets, then upgrade as usual: update to the v1.0.3 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart the service. See [Deployment](/guide/deploy) (Chinese).

## 1.0.0 · 2026-10-05

The first release, open source under the MIT license. Highlights:

- **Accounts and permissions**: password sign-in, SMS sign-in and password reset, sign-up (off by default), image and slider captchas, WeChat mini program sign-in (mini programs are apps that run inside WeChat); management of users, roles, menus, departments and positions; five data scopes; online users and force sign-out.
- **UI and languages**: Chinese and English UI; three layouts (side, top and mixed), dark mode, light / dark sidebar, tabs, lock screen, username watermark; consistent tables and forms, with column settings saved per user; a dashboard home page (**Home**).
- **System settings, auditing and monitoring**: dictionaries, parameters, bulletins; action log, sign-in log, API access log and API error log; server, MySQL and Redis monitoring and cache management; regions and IP geolocation; API docs; scheduled tasks.
- **Files, Excel and messaging**: local and S3-compatible storage, direct browser upload, authenticated download of private files; Excel import and export; inbox messages, email, SMS; realtime push over Socket.IO.
- **Code generation**: three templates (single table, tree, master-detail), usable from the web UI or the command line, optionally with mobile pages; a script to initialize a new project.
- **Workflow and forms**: tree designer and BPMN designer; approval actions such as all-must-approve (countersign), any-one approval, conditional branches, send back, transfer, add signers and withdraw; approval center; form designer, dynamic form approvals, no-code approvals; automatic timeout handling.
- **OAuth2 and single sign-on**: authorization code + PKCE, refresh tokens, client credentials; OAuth2 client management and a consent page.
- **Mobile app (optional)**: a uni-app employee app for WeChat mini programs, Android and iOS, with sign-in, Workbench, approvals, messages, realtime push and light / dark themes; testing on real devices and pre-release checks for the app stores are still in progress.
- **Security**: enabled by default — permission and data scope checks, duplicate-submit guards, rate limits, rich text sanitizing, upload file checks, SSRF protection and Excel formula injection protection; production refuses test secrets; demo mode rejects most write operations (except a few, such as signing in, switching languages and marking as read) and masks visitors' IP and browser information.
- **Deployment**: build output + nginx reverse proxy, PM2 optional; multi-instance deployment supported (cross-instance push and shared rate limits).
- **Windows**: Windows 11 with the built-in PowerShell 5.1 covers all development and checks.

Known limitations:

- No multi-tenancy yet; instant messaging and offline push for the app are planned for later releases;
- OAuth2 supports confidential clients only; public clients and OIDC are not supported yet;
- The BPMN designer supports a subset of the standard elements and converts the diagram into a tree process on publish;
- The admin console targets desktop browsers (1280 to 1920 pixels wide);
- No Docker image or docker-compose setup yet.

Changes and upgrade steps for every future release will be recorded here.
