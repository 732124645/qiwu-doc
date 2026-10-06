---
description: 'Qiwu is an MIT-licensed full-stack Node admin template on NestJS and Vue 3: live demo, tech stack, differences from Java templates and feature status.'
---

# Introduction

Qiwu (栖梧, project name `qiwu-vue-admin`) is a **full-stack Node admin template**. It provides the building blocks that business admin consoles usually need: sign-in, single sign-on, permissions, organization structure, dictionaries, logs, monitoring, scheduled tasks, messaging, files, code generation and approval workflows. You only write your own business logic on top.

![Workbench home page](/screenshots/en-home.webp)

To learn why I built this project, see [Project story](/en/guide/story).

::: info Current status
**v1.0.3** was released on 2026-10-06, open source under the **MIT license**. See the [Changelog](/en/changelog) for changes. The mobile app can already be built and debugged locally; testing on real devices and pre-release checks for the app stores are still in progress. The feature tables below show the status of each item.
:::

## Live demo

No setup needed: open the [live demo](https://demo.qiwuadmin.com) directly.

| Sign-in | Value |
| --- | --- |
| Username | `admin` |
| Password | `admin@123` |

A slider captcha appears when you sign in. Drag the puzzle piece into the gap.

::: warning Demo mode
Visitors can browse every feature. Apart from a few actions such as signing in, signing out, switching languages, saving table column settings and marking as read, write operations are rejected with the message "This action is unavailable in demo mode." Visitors' IP and User-Agent (UA) are shown masked. Do not enter real personal information.
:::

Source repository: [732124645/qiwu-vue-admin](https://github.com/732124645/qiwu-vue-admin). To run it on your machine and change the code, see [Getting started](/en/guide/getting-started).

## Who it is for

- **Students and programming beginners**: the docs start with installing the tools and using a terminal, and walk you step by step to your first feature module. There is a dedicated [Beginner tutorial](/beginner/) (Chinese).
- **Frontend developers who want to go full-stack**: if you know Vue, you can start right away. The backend also uses TypeScript, so there is no new language to learn. There is a dedicated [Backend primer for frontend developers](/backend/) (Chinese).
- **Backend developers moving from Java to Node**: the features map to admin templates like RuoYi, so the concepts are familiar at a glance. There is a dedicated [Guide for Java developers](/java/) (Chinese).
- **Small full-stack teams and agencies**: deliver a complete admin console from one repository, with types and validation rules shared between frontend and backend.
- **Indie developers**: use it as the admin base for a SaaS product or an internal tool.

## Tech stack

| Part | Choice |
| --- | --- |
| Backend | NestJS 12 (ESM), TypeORM, MySQL 8.4+, Redis 7+, Socket.IO |
| Frontend | Vue 3.5, Vite 8, Element Plus, Pinia, vue-i18n |
| Shared | `@qiwu/shared`: zod validation rules, types, error codes, permission constants |
| Tooling | pnpm workspace, TypeScript 6, Vitest, Playwright, oxlint + ESLint |

## How it differs from Java admin templates

The feature scope follows the system/infra parts of RuoYi and Yudao (popular Chinese Java admin templates). Table names, APIs, permission notation, dictionary codes and UI text are all different, and the API protocol is not compatible.

The main differences:

- **One language**: TypeScript on both ends. The same zod rule drives backend validation, frontend forms and API docs.
- **Stricter security by default**: out-of-scope access always returns 404 and does not reveal whether a record exists. The privilege escalation guard, encrypted storage of secrets, content-based detection of uploaded file types and other measures are on by default. See [Security baseline](/en/features/security).
- **Built-in internationalization**: from the first line of code, all text goes through translation keys; it was not added afterwards.
- **Node ecosystem trade-offs**: Java-only features (such as Druid monitoring and JVM panels) are replaced with equivalents, such as a MySQL status card and a Node runtime panel.

## Features at a glance

✅ Done · 🚧 In progress · ⏸ Later

For details on each feature, see the [Features overview](/en/features/).

### System management

| Feature | Status |
| --- | --- |
| Users (department tree filter, import and export, reset password, assign roles) | ✅ |
| Roles (menu permissions, data scope, assign users, privilege escalation guard) | ✅ |
| Menus (three kinds: group / page / action, where "action" means a button permission; external links, embedded pages, keep alive) | ✅ |
| Departments, positions | ✅ |
| Dictionaries, parameters | ✅ |
| Bulletins (rich text, notification bell, read statistics) | ✅ |
| My profile (profile details, password change, avatar cropping, changing the bound mobile number) | ✅ |
| App versions (register hot-update resource packages and full packages of the mobile app; the app prompts for updates on launch) | ✅ |

### Security and auditing

| Feature | Status |
| --- | --- |
| Password sign-in, SMS sign-in, sign-up (off by default), password reset by SMS | ✅ |
| Image captcha / slider captcha | ✅ |
| Lockout after failed sign-ins, sign-in IP blacklist, forced password change at first sign-in, password expiry | ✅ |
| WeChat mini program sign-in, account linking (off by default) | ✅ |
| Online users, force sign-out (the user is disconnected in real time) | ✅ |
| Action log, sign-in log, API access log, API error log | ✅ |
| Demo mode (read-only) | ✅ |

### System tools and monitoring

| Feature | Status |
| --- | --- |
| Code generation (single table / tree / master-detail, from the web UI or the command line, optionally with mobile pages) | ✅ |
| Scheduled tasks (visual cron editor, misfire policy, retries, timeouts, run log) | ✅ |
| File storage (local / S3-compatible, direct browser upload, authenticated download of private files) | ✅ |
| Inbox messages, email, SMS (Alibaba Cloud / Tencent Cloud) | ✅ |
| Server, MySQL and Redis monitoring, cache management | ✅ |
| Region tree, IP geolocation | ✅ |
| API docs (Swagger) | ✅ |
| Form designer (user, department, dictionary, attachment and region components, automatic day counts and detail totals, export to JSON and Vue code) | ✅ |

### Workflow

| Feature | Status |
| --- | --- |
| Process engine (all-must-approve / any-one / sequential, parallel and conditional branches, send back, transfer, add signers, withdraw, overdue reminders) | ✅ |
| Approval center (to-dos, handled tasks, my requests, CC to me, reminders, printing) | ✅ |
| Leave request sample (a business form connected to a process) | ✅ |
| Process designer (tree style, similar to DingTalk approvals; checks before publishing and points to the faulty node) | ✅ |
| BPMN designer (standard diagram notation, converted to a tree process on publish; import and export of `.bpmn`, read-only diagram on the instance detail) | ✅ |
| Automatic timeout handling (approve automatically, reject automatically or hand to the manager when overdue) | ✅ |
| Process model management (categories, versions, JSON export and import), progress tree | ✅ |
| Dynamic form approvals (field access, a user picked in the form as approver, private attachments) | ✅ |
| No-code approvals (New approval wizard with built-in templates for general approval, leave, expense claim and overtime) | ✅ |
| Approval data (filter by form fields, export to Excel) | ✅ |

### Other

| Feature | Status |
| --- | --- |
| Three layouts, tabs, dark mode, light / dark sidebar, lock screen, username watermark, Chinese / English switch | ✅ |
| Multi-instance deployment (cross-instance realtime push, rate limits shared through Redis) | ✅ |
| Server deploy kit (one directory per release, PM2 cluster restarts one process at a time, health checks, automatic switch back to the previous release's code on failure) and GitHub Actions checks and releases | ✅ |
| New project script (sets up a separate database, Redis database number, secrets and system name for the new project) | ✅ |
| OAuth2 authorization server / single sign-on (authorization code + PKCE, so other systems can let users sign in with their Qiwu accounts; OAuth2 client management, consent page, remembered consent) | ✅ |
| Mobile app (uni-app: WeChat mini program, Android, iOS; sign-in, Workbench, messages, approvals (including dynamic forms), realtime push, WeChat subscribe message reminders and app update checks are done, with light and dark themes; checks on real devices before release are still in progress) | 🚧 |
| Multi-tenancy | ⏸ (extension points reserved) |
| Other third-party sign-in (GitHub, DingTalk, WeCom, Feishu (Lark), WeChat QR code, etc.) | ⏸ |
| Instant messaging (one-to-one chat, group chat, staff directory), offline push for the app | ⏸ |

## Contributing

Qiwu is open source and contributions are welcome. Pick the place that fits what you want to do:

| What you want to do | Where to go |
| --- | --- |
| Ask a question, share usage tips or ideas | [Discussions](https://github.com/732124645/qiwu-vue-admin/discussions) |
| Report a bug or suggest a feature | [Issues](https://github.com/732124645/qiwu-vue-admin/issues); use the issue templates and include the version, environment and reproduction steps |
| Contribute code, or improve the docs in the template repository | Read the [contributing guide](https://github.com/732124645/qiwu-vue-admin/blob/main/CONTRIBUTING.md) first, then open a pull request; for larger changes, discuss the approach in Discussions or an issue first |
| Report a security vulnerability | **Do not report it in public.** Report it privately as described in [Reporting a vulnerability](/en/features/security#reporting-a-vulnerability) |
| Point out a mistake on this docs site | Use "Edit this page on GitHub" at the bottom of the page, or leave a comment below it |

## Next steps

- [Getting started](/en/guide/getting-started): run it on your machine
- [Project structure](/guide/structure) (Chinese): how the code is organized
- [Adding a business module](/guide/new-module) (Chinese): write your first business page with the code generator
