---
description: 'Overview of Qiwu admin features by menu: system management, OAuth2 single sign-on, MCP agent access, the assistant, permissions, multi-tenancy, code generator, form designer, workflow, mobile, WeChat Official Accounts and security.'
---

# Features overview

This section describes **what Qiwu can do**: which admin console menu each feature lives under, how administrators use it, and what its limitations are. It does not cover code; to use these capabilities in your own modules, every page ends with links to the [Developer guide](/core/) (Chinese).

For the status of each item, see [Introduction · Features at a glance](/en/guide/introduction#features-at-a-glance).

## System

| Feature | In one sentence |
| --- | --- |
| [System management](/en/features/system) | Users, roles, menus, departments, positions, dictionaries, parameters, regions, OAuth2 clients, app versions, my profile (including access tokens) |
| [Sign-in and accounts](/features/login) (Chinese) | Password, SMS and WeChat mini program sign-in, captchas, lockout after failed attempts, password policy, online users |
| [Single sign-on (OAuth2)](/en/features/oauth) | Let other systems sign users in with their Qiwu accounts: OAuth2 client management, consent page, remembered consent |
| [MCP agent access](/en/features/mcp) | Let agents (AI assistants) call the console's tools with the user's own permissions: personal access tokens or OAuth2, guardrails, action log; off by default |
| [Assistant](/en/features/agent) | A chat page in the console: a model / agent uses the console's tools to look up data, search the web and change data for you, with human confirmation before changes by default; skills, batch runs, automations, memory and deep research; off by default |
| [Permissions and data scope](/en/features/permission) | Menu and button permissions, five data scopes, privilege escalation guard |
| [Multi-tenancy](/en/features/multi-tenancy) | One deployment serving many companies: tenants, tenant packages, bound domains, brands, platform staff entering a tenant; off by default |
| [Monitoring and logs](/features/monitor) (Chinese) | Server, MySQL, Redis and job queue monitoring; action log, sign-in log, API access and error logs |
| [Scheduled tasks](/features/job) (Chinese) | Visual cron editor, misfire policy, retries, timeouts, run log, plus built-in system tasks |
| [Message center](/features/messaging) (Chinese) | Inbox messages, email, SMS, WeChat subscribe messages, multilingual message templates, send records |
| [File management](/features/storage) (Chinese) | Local or S3 storage, direct browser upload, public and private files |

## Developer tools

| Feature | In one sentence |
| --- | --- |
| [Code generator](/en/features/codegen) | Create a table and generate frontend and backend code, menus, permissions and tests, optionally mobile pages too |
| [Form designer](/en/features/formkit) | Design forms by drag and drop, export to JSON and Vue code |
| [Developing with AI](/en/guide/ai) | Guide: shared development rules, task recipes and a project map so AI coding tools follow the template's conventions |

## Approvals

| Feature | In one sentence |
| --- | --- |
| [Workflow](/en/features/workflow) | Draw processes in the tree or BPMN designer, no-code approvals, dynamic forms, automatic timeout handling, approval data |
| [Office requests](/en/features/oa) | Leave, travel, expenses, seal use and general forms; shared approval center, private files and notices; personal confirmation per assistant request |
| [Attendance](/en/features/attendance) | Native mobile clock-in/out, policies and sites, personal and department queries, approved leave/travel links; no DingTalk required |

## Mobile

| Feature | In one sentence |
| --- | --- |
| [Mobile app](/en/features/mobile) | The employee phone client (WeChat mini program, Android, iOS): sign-in, Workbench, approvals, messages, new to-do WeChat alerts, app updates |

## Operations

| Feature | In one sentence |
| --- | --- |
| [WeChat Official Accounts](/en/features/wxoa) | Manage one or more Official Accounts: messages and conversations, auto replies, custom menus, fans and tags, materials, channel QR codes, plus article publishing, mass messages and statistics; off by default |

## Cross-cutting capabilities

| Feature | In one sentence |
| --- | --- |
| [Internationalization](/en/features/i18n) | The UI, error messages, menus, dictionaries, message templates and Excel headers all switch between Chinese and English |
| [Realtime push](/features/realtime) (Chinese) | New messages, force sign-outs and approval to-dos arrive instantly, without refreshing the page on desktop or mobile |
| [Security baseline](/en/features/security) | Security measures that are on by default, each covered by a test or an automated check |
