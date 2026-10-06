---
description: 'Qiwu release notes: version 1.0.3 adds GitHub Actions checks, automated releases and a server deploy kit, plus fixes; version 1.0.0 covers permissions, workflow, code generation, the mobile app, deployment and known limitations.'
---

# Changelog

This page records the changes in each Qiwu release. For the current features and the status of each one, see [Introduction · Features at a glance](/en/guide/introduction#features-at-a-glance).

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
