---
description: 'Default-on security measures: random tokens instead of JWT, sign-in lockout, OAuth2 PKCE, IDOR defenses, tenant isolation, injection defenses, upload checks and vulnerability reports.'
---

# Security baseline

The following measures are **on by default**, and each one has matching tests or automated checks. For the full list of threat defenses and their tests, see the repository's [security docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#威胁防护与测试入口) (Chinese).

## Authentication and sessions

- **No JWT.** Access tokens and refresh tokens are both random strings, and Redis stores only their hashes;
- Access tokens last 30 minutes by default and renew automatically while you are active, but **never beyond an absolute cap** (12 hours; 7 days when **Keep me signed in** is ticked or when signing in on mobile. Both caps are fixed and cannot be configured);
- Refresh tokens are stored in an `HttpOnly` + `SameSite=Strict` cookie and are replaced after every use. If an old token is reused, the whole session chain is revoked;
- The refresh endpoint and the password and SMS sign-ins that set this cookie check where the request comes from (`Origin`): a request from another site, or with a `null` origin, gets 403. This stops another site from signing its own account into your browser (login CSRF). The reverse proxy must pass `Host` and the scheme to the server unchanged, or the console's address must be listed in `CORS_ORIGIN`; see [Deployment · Reverse proxy](/guide/deploy#反向代理-nginx) (Chinese);
- When an administrator resets a password or disables or deletes a user, and when a password is reset through an SMS code, all of that user's sessions end. When users change their own password, all their other sessions end and only the current one stays. Force sign-out ends only the session it targets (**End all sessions** ends all sessions of that user). The WebSocket connections of ended sessions are also closed at once;
- When users change their own password, reset it through an SMS code, or have it reset by an administrator, **the account's WeChat mini program link is also removed**. So even if someone once used a leaked password to link their own WeChat account, they can no longer sign in after the password change. Force sign-out does not unlink.

## Sign-in protection

- Rate limits: counted separately by IP and by username. The per-IP counters are stored in Redis, so multiple service instances share the same quota. If Redis has a temporary error, requests fail outright (500) instead of being let through (see [Deployment · Multi-instance deployment](/guide/deploy#多实例部署) (Chinese));
- Five failures in a row for the same username + IP pair lock that pair for 10 minutes. Only that pair is locked, so nobody can use this to lock out the administrator's account;
- When one username has too many failures in total across several IPs, a captcha becomes mandatory;
- Usernames that do not exist are counted too, and their responses match those of existing usernames in both content and timing, so this cannot be used to probe whether an account exists. A sign-in name must use the stored username format (full-width characters are folded first); other spellings get 400, so they cannot land on another counter and reveal whether an account exists;
- Parallel password guesses are counted before the password is checked, so at most the lock threshold of them reach the password check; see the repository's [security docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#威胁防护与测试入口) (Chinese);
- Supported as well: an IP blocklist (single addresses or CIDR ranges; `*` wildcards are not supported, and malformed entries are ignored), mandatory password change at the first sign-in, password expiry, and a password complexity policy (the frontend and backend use the same rules).

## WeChat mini program sign-in

WeChat mini programs are lightweight apps that run inside WeChat, the messaging app widely used in China. For the feature and how to enable it, see [Sign-in and accounts · WeChat mini program sign-in](/features/login#微信小程序登录) (Chinese). Only the security rules are listed here:

- **Off by default.** If the switch `auth.wx_mp.enabled` is off, or `WX_MP_APPID` / `WX_MP_SECRET` is missing, the sign-in and link endpoints return 404;
- The `code` sent by the mini program can be used only once. The `session_key` returned by WeChat is discarded as soon as the server receives it: it is neither stored nor sent to the client;
- A WeChat account that is not linked yet gets a **link ticket**: valid for 5 minutes, usable only once, and only from the same IP;
- Linking requires proving your identity with the account password or an SMS code, under the same captcha, lockout and rate-limit rules as normal sign-in. The same WeChat account cannot be linked twice (409), and an account can be linked to only one WeChat account;
- Unlinking works even when the switch is off, and it ends the user's sessions on other phones (the current one stays);
- Every WeChat sign-in is recorded in the sign-in log with the type `wx-mp`. When identity verification passes but linking is refused, a failed entry is recorded as well.

## Single sign-on (OAuth2)

For the feature, see [Single sign-on (OAuth2)](/en/features/oauth); for integration details, see the [OAuth2 integration guide](/reference/oauth2) (Chinese). Only the security rules are listed here:

The authorization code flow requires PKCE with `S256`, and only confidential clients with a secret are supported. Client secrets are shown only once, and the database stores only their SHA-256 digest. Redirect URIs are compared character by character, and the consent page never redirects for an invalid request. Third-party tokens can only call the user info endpoint. When a user changes their password, is disabled or is signed out, or a client is disabled, the related sessions end together. Secrets, authorization codes and tokens in logs are masked automatically. For the rules, see the repository's [OAuth2 docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#7-令牌隔离与会话) (Chinese).

## Broken access control (IDOR)

- Every endpoint that reads, edits or deletes by id first checks whether the record is within the current user's data scope; out-of-scope records return 404;
- Privilege escalation guard: you cannot give others more permissions than you have. See [Permissions and data scope](/en/features/permission). Resetting someone else's password or setting their sign-in mobile number requires that you could assign all of that user's roles, and moving a department is checked as a grant too; see [Privilege escalation guard](/en/features/permission#privilege-escalation-guard);
- Attachments in process forms are private files. Apart from the uploader, the super administrator and people with the **View** permission of the file list (`storage.object.view`), only people who can view the process instance and can see the attachment field can download them; see [Workflow · Attachments](/en/features/workflow#attachments).
- Approval data is filtered by field access: only the super administrator and the process managers of that process see all fields. Others do not see fields that were hidden at any step of the process (not on the page, in exports or in filters). Because process managers can see all fields, changing the list of process managers needs the separate permission `wf.model.managers`; people with only `wf.model.modify` cannot add themselves (403). See [Workflow · Field access in approval data](/en/features/workflow#field-access-in-approval-data).

## Tenant isolation

With [multi-tenancy](/en/features/multi-tenancy) on, the ORM (the layer that turns reads and writes of objects in code into SQL) automatically adds the current tenant's condition to every query, write and join on a tenant table, and not even the super administrator can skip it; for hand-written SQL, automated checks require the tenant condition. Accessing another tenant's data returns 404, the same as data that does not exist; calls from people in a tenant to the APIs of [platform-only pages](/en/features/permission#tenant-packages-and-platform-only-pages) are rejected. The tenant of a session comes from the user, and there is no request header that switches tenants. Platform staff need a dedicated permission to enter a tenant, leave it automatically after 2 hours, and are audited throughout. For the tests, see the repository's [security docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#威胁防护与测试入口) (Chinese).

## Injection and code execution

- Only parameterized SQL is used, and sort fields are checked against an allowlist. A check script forbids concatenating strings into SQL;
- `eval`, `new Function` and `vm` are banned (checked by lint and by scripts);
- Scheduled tasks can only call handlers on an allowlist, and process conditions can only use structured rules;
- Form schemas saved by the form designer are rendered in other people's browsers, so on save the frontend and backend check them against **the same allowlist**. Functions, strings that would run as code (such as `$FN:`), event and linkage settings, and unknown components are rejected outright with 400; settings outside the allowlist are stripped, and the server stores only the filtered result. See [Form designer · Security](/en/features/formkit#security);
- BPMN is treated only as data: only allowlisted elements are accepted, and scripts, expressions, listeners, DOCTYPEs and files over 80 KiB are always rejected. What runs is the tree the server derives from the XML. See [Workflow](/en/features/workflow) and the repository's [BPMN docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/workflow-bpmn.md#发布规则与错误) (Chinese);
- After the build, `pnpm ci:local` scans the frontend output to make sure it contains no `eval` / `Function` calls outside the allowlist, and no wangeditor v4 code.

## XSS

- Rich text is sanitized against an allowlist when it is saved (removing `style`, `on*`, `script` and `iframe`);
- Inbox messages are handled as plain text; mail previews are shown in a sandboxed iframe;
- Frontend pages carry a strict Content Security Policy (CSP).

## File uploads

- The real type is detected from the **file content**, never trusting the extension. An extension allowlist is used, and `html`, `svg` and `js` can never be uploaded;
- Files are saved under random names to prevent path traversal;
- Downloads force `attachment` + `nosniff` + `CSP sandbox`;
- Private files can only be downloaded through an authenticated endpoint.

## SSRF

For external addresses that administrators can configure (S3, SMTP), the server resolves DNS before connecting, rejects private network, loopback and cloud metadata service addresses, and allows only ports on an allowlist.

When editing an S3 storage config, if you change any of **Endpoint**, **Bucket** or **Access key ID**, you must enter the **Secret access key** again; otherwise you get 422 and none of the change is saved. This way, someone who can edit storage configs cannot carry a saved key over to another address.

## Other

- **Excel**: on export, cells starting with `=`, `+`, `-` or `@` are escaped to prevent formula injection. On import, file size and row count are limited, and files containing macros are rejected. Before parsing, the real unpacked size of every part is counted, so a file that lies about its sizes gets 400 instead of exhausting memory; see [Excel import and export · Import limits](/core/excel#导入限制) (Chinese);
- **Duplicate submits**: create-type endpoints guard against duplicate submits on the server; a repeated request within 3 seconds returns 429 (for how to write it, see [Duplicate-submit guards, rate limits and locks](/core/guards) (Chinese));
- **Sensitive data**: passwords are stored with bcrypt. Secrets of third-party services (such as S3 and SMTP) are encrypted with AES-256-GCM before being stored in the database. OAuth2 client secrets are stored only as SHA-256 digests. Fields such as passwords and tokens in logs are masked automatically;
- **Production secret check**: if `APP_SECRET` or `SEED_ADMIN_PASSWORD` carries the `not-for-production` marker, the service and the database commands refuse to run in production. Every test password committed to the repository carries this marker, so none of them can slip into production by mistake. The check does not judge strength, so generate production secrets yourself; see the repository's [security docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#生产配置与凭据) (Chinese);
- **Assistant**: the [assistant](/en/features/agent) calls tools with the requesting user's own permissions, data scope and tenant, never runs a write before a person confirms it, connects only to public addresses for web reading and external MCP, and stores the keys of models and other services encrypted and write-only; see the repository's [in-app agent section](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#后台智能体智能助手) (Chinese);
- **Demo mode**: apart from a few operations such as signing in and out, and entering and leaving tenants, all write operations return 403, for the super administrator too, and visitor details in the logs are masked. See [Deployment · Demo mode](/guide/deploy#演示模式) (Chinese) and the repository's [list of exemptions](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#演示模式的精确豁免) (Chinese);
- **Supply chain**: dependency versions are locked; a new version can be installed only once it has been released for 24 hours; the install scripts of dependencies must be approved one by one; dependency licenses are checked automatically;
- **Dependency license and originality checks**: `pnpm verify` checks the licenses of production dependencies (only permissive licenses on the allow list; banned packages always fail), requires packages used by the web app to be production dependencies, keeps TypeScript, Vite, Vue, Element Plus and Vitest at a single version across the repository, and rejects identifiers of other admin projects and colon-separated permission strings. A project built on the template may adjust the allow list; see the repository's [dependency license and originality checks](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#依赖许可与原创性检查) (Chinese).

## Reporting a vulnerability

**Do not** disclose vulnerability details in public issues, discussions or pull requests; report them through GitHub private vulnerability reporting: [repository](https://github.com/732124645/qiwu-vue-admin) → **Security** → **Report a vulnerability**. For supported versions, response, disclosure and scope (including not running destructive tests against the live demo), see the [security policy](https://github.com/732124645/qiwu-vue-admin/blob/main/SECURITY.md#reporting-a-vulnerability).
