---
description: 'Overview of Qiwu admin features by menu: system management, OAuth2 single sign-on, permissions, code generator, form designer, workflow, mobile and security.'
---

# Features overview

This section describes **what Qiwu can do**: which admin console menu each feature lives under, how administrators use it, and what its limitations are. It does not cover code; to use these capabilities in your own modules, every page ends with links to the [Developer guide](/core/) (Chinese).

For the status of each item, see [Introduction · Features at a glance](/en/guide/introduction#features-at-a-glance).

## System

| Feature | In one sentence |
| --- | --- |
| [System management](/en/features/system) | Users, roles, menus, departments, positions, dictionaries, parameters, regions, OAuth2 clients, app versions, my profile |
| [Sign-in and accounts](/features/login) (Chinese) | Password, SMS and WeChat mini program sign-in, captchas, lockout after failed attempts, password policy, online users |
| [Single sign-on (OAuth2)](/en/features/oauth) | Let other systems sign users in with their Qiwu accounts: OAuth2 client management, consent page, remembered consent |
| [Permissions and data scope](/en/features/permission) | Menu and button permissions, five data scopes, privilege escalation guard |
| [Monitoring and logs](/features/monitor) (Chinese) | Server, MySQL and Redis monitoring; action log, sign-in log, API access and error logs |
| [Scheduled tasks](/features/job) (Chinese) | Visual cron editor, misfire policy, retries, timeouts, run log, plus built-in system tasks |
| [Message center](/features/messaging) (Chinese) | Inbox messages, email, SMS, WeChat subscribe messages, multilingual message templates, send records |
| [File management](/features/storage) (Chinese) | Local or S3 storage, direct browser upload, public and private files |

## Developer tools

| Feature | In one sentence |
| --- | --- |
| [Code generator](/en/features/codegen) | Create a table and generate frontend and backend code, menus, permissions and tests, optionally mobile pages too |
| [Form designer](/en/features/formkit) | Design forms by drag and drop, export to JSON and Vue code |

## Approvals

| Feature | In one sentence |
| --- | --- |
| [Workflow](/en/features/workflow) | Draw processes in the tree or BPMN designer, no-code approvals, dynamic forms, automatic timeout handling, approval data |

## Mobile

| Feature | In one sentence |
| --- | --- |
| [Mobile app](/en/features/mobile) | The employee phone client (WeChat mini program, Android, iOS): sign-in, Workbench, approvals, messages, new to-do WeChat alerts, app updates |

## Cross-cutting capabilities

| Feature | In one sentence |
| --- | --- |
| [Internationalization](/en/features/i18n) | The UI, error messages, menus, dictionaries, message templates and Excel headers all switch between Chinese and English |
| [Realtime push](/features/realtime) (Chinese) | New messages, force sign-outs and approval to-dos arrive instantly, without refreshing the page on desktop or mobile |
| [Security baseline](/en/features/security) | Security measures that are on by default, each covered by a test or an automated check |
