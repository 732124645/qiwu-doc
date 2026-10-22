---
description: 'Qiwu release notes: version 1.9.0 gives the assistant automations (skills run in the background on a schedule, after a business action or on demand), profiles, personal memory, automatic review, sub-agents and deep research, charts and exports, a diagnostics page and notification settings; version 1.8.0 adds an in-app assistant (off by default, switch APP_AGENT; OpenAI-compatible models, web search, external MCP servers, skills and batch runs, with every data change confirmed by a person); version 1.7.1 fixes list action columns that clipped their buttons (extra buttons move into a More menu); version 1.7.0 lets AI coding tools understand the template''s conventions (one set of development rules, a project rules file, ten task recipes, a project map, check failures that say how to fix them), with no runtime change; version 1.6.0 adds MCP agent access (off by default, switch APP_MCP, personal access tokens and OAuth2) and makes merging template releases into projects easier; version 1.5.0 adds a WeChat Official Account management module (off by default, switch APP_WXOA, tables still created by the migrations); version 1.4.0 is a security release (password resets and department moves judged as grants, a sign-in origin check, a sign-in username format check, hardened Excel import and more) with upgrade notes on the reverse proxy and usernames; version 1.3.1 adds the QW_INSPECT switch for server breakpoint debugging and VS Code debug configurations; version 1.3.0 adds job queues on the existing Redis and a queue monitor page; version 1.2.0 lets hand-written SQL in the code apply data scope too, with a new check; version 1.1.0 adds multi-tenancy (one shared database with data isolated per tenant, tenants, tenant packages, platform staff entering a tenant) with notes on upgrading and turning it on; version 1.0.3 adds GitHub Actions checks, automated releases and a server deploy kit, plus fixes; version 1.0.0 covers permissions, workflow, code generation, the mobile app, deployment and known limitations.'
---

# Changelog

This page records the changes in each Qiwu release. For the current features and the status of each one, see [Introduction · Features at a glance](/en/guide/introduction#features-at-a-glance).

## 1.9.0 · 2026-10-22

The second set of [assistant](/en/features/agent) features: it can run in the background on a schedule or after a business action, remember your preferences, hand low-impact changes to a review model, delegate subtasks, do deep research, draw charts and export its results. The assistant is still off by default (switch `APP_AGENT`). For the full reference in the repository, see the [in-app agent docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md) (Chinese).

Added:

- **Automations**: a new page **Agent → Automations** (permission `agent.automation.use`; sharing with the whole tenant also needs `agent.automation.share`). A skill or a prompt runs on a schedule (5-field cron with a time zone, at most every 5 minutes), after a business action is written to the action log (only when the owner can see the record) or on demand; each run happens in a hidden conversation as its owner, with permissions checked again every time. Write modes: read only (default), ask (the approval cards go to the inbox) and pre-approved (write tools ticked one by one, confirmed with the current password). A pre-approval holds only while the owner's permissions, data scope and department, the tool's switch and the bound personal or platform skill and personal profile are unchanged; otherwise the write waits for a person. Run history, results in the inbox with optional mail; limits per user and per day; one run at a time per automation.
- **Profiles**: a named set of model, reasoning effort, approval mode, allowed tools and extra instructions, personal or tenant-wide (tenant-wide ones can only be read only or ask), picked for a new conversation or set as the default.
- **Personal memory**: "remember …" saves only after you confirm; an optional background distiller reads only your own messages. Passwords, keys and the like are masked before saving; temporary conversations never use memory, and it can be turned off per conversation; **My memories** lists, edits and deletes entries, and **Forget everything** needs your current password.
- **Automatic review**: once an administrator sets a write tool to **Auto review** and the conversation is in auto review mode, a review model (the super administrator's parameter `agent.review.model`) approves, rejects or hands over each write; anything unclear, truncated or failed goes to a person; at most 10 reviews per turn.
- **Sub-agents, deep research, charts and exports**: the agent can hand 1 to 3 read-only subtasks to sub-agents running in parallel; a new platform skill, deep research, has its own step and time limits and ends with a cited report; charts (bar, line, pie, table), image generation with models marked **Image**, and exports to xlsx, Markdown and print.
- **Diagnostics and personal settings**: a new **Diagnostics** tab on **Agent settings** (super administrator) tests whether models, search providers and external MCP servers can be reached, and shows turn counts, recent failed turns and orphan turn sweeps. Everyone can set notifications (always in the inbox, mail optional), customize the chat page's keyboard shortcuts and open a conversation in a new window.
- **For projects**: three extension points, built-in tools, context contributors and approval reviewers; a new recipe `docs/ai/recipes/agent-extension.md` with its skill `qiwu-agent-extension`.

Changed:

- The assistant's reminders no longer carry the conversation title; in inbox templates installed earlier, the conversation number now shows where the title used to be.
- The action log no longer records the text of memories and chat messages.

Upgrade notes:

- One database migration, `20261022091719-agent-automation`: it creates 4 tables for profiles, memories, automations and automation runs (`agent_profile`, `agent_memory`, `agent_automation`, `agent_automation_run`) and adds 4 columns to the conversation table `agent_thread` (the profile used, whether memory is on, the parent conversation of a sub-agent, the automation run it belongs to). As before, **these tables are created whether or not the switch is on**.
- `pnpm db:seed` writes the **Automations** menu and permissions, the new system parameters, the inbox and mail templates for automations, mail templates for the reminders, and the platform skill deep research. Existing templates are not overwritten. The new parameters (review model, memory distilling, memories per turn, deep research steps and time, automations per user and runs per day) are in the repository's [parameter table](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#限额暂停与用量) (Chinese).
- No new environment variables and no new dependencies.
- Upgrade as usual: update to the v1.9.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart the server; see [Deploy](/guide/deploy) (Chinese).

## 1.8.0 · 2026-10-22

Adds an in-app **assistant**, off by default. Staff state what they need in plain language on a chat page, and a model / agent uses the console's own tools, as that user, to look up data, search the web and change data as asked; every change is confirmed by a person first. See [Assistant](/en/features/agent); for the full reference in the repository, see the [in-app agent docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md) (Chinese).

Added:

- **Switch**: set `APP_AGENT=true` in the server environment to load the module; restart after changing it. While off, every `/api/agent/*` route returns 404 and the **Agent** menu group is hidden. It runs on the existing job queue, Redis and Socket.IO; no new service is needed.
- **Chat page**: a conversation list like a desktop chat app (search, rename, pin, archive, delete, unread and running views, temporary conversations), streamed answers with collapsible tool calls, a reasoning summary, citations and suggested follow-ups; fork from any message, edit and resend, revert the last turn, share a read-only link within the tenant, export Markdown, copy and rate messages. A message sent while a turn runs joins the current turn or waits for the next one, and the turn can be stopped. Slash commands, `$` to call a skill, attachments from file storage (text, the first sheet of an xlsx, images for models that read them), a context gauge with automatic and manual compaction, and an inbox message when a turn waits for you or a long one finishes. A button in the corner of every page opens the chat with the current page and the selected rows.
- **Tools only**: the agent acts through the modules' `@McpTool` methods (the same list and checks as MCP), run in-process with the signed-in user's permissions, data scope and tenant, plus built-in tools for a plan checklist, questions with options and loading a skill. Each conversation picks an approval mode: read only, ask (default) or trust this conversation. A write tool **never runs before a person confirms it**: the approval card shows the tool, the record, each field's current and proposed value and the web sources the turn read. Plan mode lists the steps before anything changes.
- **Models and the web**: models through any OpenAI-compatible Chat Completions API (DeepSeek, Qwen, Kimi, Zhipu, Ollama, OpenAI and others) with streaming, tool calls and reasoning effort, chosen per conversation. Web search through Bocha or Tavily; a page reader limited to the turn's search results, the user's links and allowed sites, checking for a public address on every redirect; web pages and external output are handed to the model as untrusted content. External MCP servers (Streamable HTTP, header token or OAuth client credentials) with their tools enabled one by one, each with its own approval policy; a server's request for more input shows as a question card.
- **Skills, instructions and templates**: skills at platform, tenant and personal level (create, edit, enable, import and export as `SKILL.md`, drafted from a conversation), loaded only when used; platform, tenant and personal instructions with a tone preset; prompt templates.
- **Platform settings (super administrator)**: model providers, search providers, external MCP servers, tool policies (write tools can only ask or be denied), platform skills, instructions and limits (steps, time and tokens per turn, tokens per user and per tenant per day, concurrent turns per user), and the emergency stop parameter `agent.paused`. Keys are encrypted with a key derived from `APP_SECRET` and never returned. A usage page sums calls and tokens by day, user or model; every tool call is in the action log.
- **Batch runs**: run a skill on the rows selected in a list, one conversation per record, started in turn within the concurrency limit, and confirm the resulting changes one by one or all at once on a batch review page. Sample: **Sample customers** with the platform skill 补齐客户信息 ("fill in customer details": fill empty fields from the web, with sources) and the tools `demo.customer.search`, `demo.customer.get` and `demo.customer.update`.
- **For projects**: write tools may declare a `preview` method for the approval card, and `@AgentBatchTarget` makes a list's records batchable; a new recipe `docs/ai/recipes/agent-skill.md` with its skill `qiwu-agent-skill`.

Upgrade notes:

- One database migration: it creates the assistant's 14 tables (`agent_*`) and the sample customer table `demo_customer`, and adds an approval policy column to the MCP tool switch table `cfg_mcp_tool`. **These tables are created whether or not the switch is on.** `pnpm db:seed` writes the **Agent** menu group, its parameters, two inbox templates, the sample customer menu and data, and the platform skill 补齐客户信息 (the **Agent** menus stay hidden while the switch is off).
- New server environment variable `APP_AGENT`, `false` by default; leave it unset if you don't need the module. The keys of models and search services are not environment variables: once it is on, enter them on **Agent → Agent settings**. For turning it on and the outbound firewall, see [Deploy · Assistant](/guide/deploy#智能助手) (Chinese).
- One new server dependency, `openai` (7.39.0, Apache-2.0), used to call OpenAI-compatible model services; it has no install scripts, and `pnpm i` installs it.
- Upgrade as usual: update to the v1.8.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart the server; see [Deploy](/guide/deploy) (Chinese).

## 1.7.1 · 2026-10-22

Fixes list action columns that clipped into an ellipsis, where a click could hit a hidden button.

Changes:

- **Row action buttons**: only the first few buttons show inline (**Row buttons shown in tables** in **Page settings**, 2 by default; a single table can override it with `actions-visible`); the rest go into a **More** menu that opens on hover; dangerous actions always come last; buttons the user lacks the permission for take no space; the column width is measured from the buttons actually rendered, and an explicit `actions-width` still wins. See [System management · What all list pages share](/en/features/system#what-all-list-pages-share).
- The template's own pages dropped their hand-tuned action column widths, and the tree page from the code generator no longer hard-codes one.

Upgrade notes:

- No database migrations and no environment variable or dependency changes; only the web app (and the generator's page template) changed, so rebuild the web app.
- Your own list pages need no change: a page with `actions-width` keeps that width; remove it to have the width measured. A page whose actions already contain its own "More" dropdown should pass `:actions-visible="Infinity"` to `QwTable`, so there are not two "More" menus.

## 1.7.0 · 2026-10-21

Lets AI coding tools understand the template's development conventions; no runtime change. See [Developing with AI](/en/guide/ai); for the full reference in the repository, see the [AI development docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/ai.md) (Chinese).

Added:

- **Development rules**: `AGENTS.md` at the repository root sets out the conventions for building on the template: layout and layering, naming, API, i18n, multi-tenancy and data scope, security defaults, the CRUD kit, migrations and seeds, generator first, tests and the definition of done, commands, and what each check failure means. The entry files of the common AI coding tools all point to it; for which tool reads which file, see [Developing with AI](/en/guide/ai#files-in-the-repository). A project keeps its own rules in `docs/project-rules.md`; the template does not ship that file, so template upgrades never conflict with it.
- **Task recipes**: ten step-by-step recipes in `docs/ai/recipes/`, each with its done checks: a new business module (generator first), tables and migrations, permissions and menus, dicts and system parameters, data scope, hand-written SQL and tenants, queue and scheduled jobs, MCP tools, i18n strings and API tests; each recipe has a matching skill (`qiwu-*`).
- **Project map**: `pnpm ai:map` parses the source statically and writes `docs/ai/project-map.md`, listing modules and feature switches, tables, every API route with its permission, permission codes, menus, dicts, system parameters, queues, scheduled jobs and MCP tools. `pnpm verify` fails when the map is stale.

Changed:

- **Check failures say how to fix them**: when the architecture checks, `i18n:check`, `originality:check` or `license:check` fail, the error ends with a `fix:` line (what to change) and a `see:` line (a link to the doc that explains the rule). A new architecture check, `ai-docs`, makes sure the scripts, paths, links and anchors named in the AI docs exist.

Upgrade notes:

- No database migrations, no environment variable or dependency changes, and no change to the server or web runtime code; nothing to redeploy.
- After merging, `pnpm verify` checks the project map: if your project has its own modules, tables or endpoints, it reports the map as stale; run `pnpm ai:map` to regenerate it and commit the result. Do this after every merge of a new template release; see [Upgrading the template](/guide/upgrade#合并后的检查) (Chinese).
- To have AI tools follow your project's own conventions, create `docs/project-rules.md`; see [Developing with AI](/en/guide/ai#adding-your-project-s-own-rules).

## 1.6.1 · 2026-10-21

Improves the admin when the server cannot be reached.

Changes:

- **Waits on the requested page while the API is unreachable**: when the API does not answer while the page loads (a refresh or a new tab during a restart, a deploy or a stopped server), the address stays on the requested page and a "connecting" screen waits until the server is back, then opens the page by itself. It no longer gives up after about 20 seconds for a separate 503 page with retry and sign-in buttons (the `/503` route is removed). Failures during this load no longer show error toasts. If the API answers with its own server error for about 20 seconds, it still goes to the sign-in page.
- **README**: a feature overview, screenshots and links to the related guides.

Upgrade notes:

- No database migrations, and no environment variable or dependency changes. Only the front end changed; rebuild it.

## 1.6.0 · 2026-10-20

Adds MCP agent access, off by default. **MCP** (Model Context Protocol) is an open standard for how agents (AI assistants) discover and call tools; once it is on, an agent can call the console's tools as a particular user, never with more rights than that user. See [MCP agent access](/en/features/mcp); for the full reference in the repository, see the [agent access docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md) (Chinese).

Added:

- **Switch**: set `APP_MCP=true` in the server environment to load the module, then restart. While off, `/api/mcp`, its discovery documents and every admin route return 404, and the **MCP tools** and **Access tokens** pages are hidden. While running, the parameter `mcp.paused`, which only the super administrator can change, stops every tool call at once.
- **Endpoint**: `POST /api/mcp`, tools only (initialize, list tools, call a tool), stateless. A tool is a service method marked `@McpTool`, registered at startup; see [Add MCP tools to a module](/core/mcp) (Chinese).
- **Two ways in**: personal access tokens (created on the **Access tokens** tab of My profile with the current password, shown once, valid for up to 90 days or without expiry, optionally limited to some tools and with an explicit write permission, revocable at any time; they end for good when the user is disabled, deleted, changes or has the password reset, is signed out by an administrator, or the tenant is disabled); and OAuth2 clients registered in OAuth2 clients with the new scopes `mcp` and `mcp.write`. Both run with the token's own user's permissions, data scope and tenant.
- **Guardrails**: the emergency stop, a per-token rate limit, a per-tool switch, the token's tool list and write permission, permission codes, argument validation (at most 32 levels deep and 16 KiB), a time limit, masking of secret fields in the output and a 64 KiB answer limit; every call writes one **Agent call** row to the action log, marked as done by an agent on the user's behalf.
- **Sample tools**: `iam.me.get`, `iam.user.search` (the same data scope as the user list), `cfg.dict.options`, and the write tool `demo.book.create`.

Changed:

- **Fewer conflicts when upgrading the template**: the template's server tests no longer hard-code the template's own structure (the migration list is read from the migrations directory; tables and columns are checked by rules), and a project registers its own platform tables and global unique keys in `apps/server/src/db/project-tables.ts` instead of editing the template's list. A new guide, [Upgrading the template](/guide/upgrade) (Chinese), walks through it.
- **Faster server tests**: the migration round trip runs in one process, about twice as fast; script timeouts can be set with `QW_TEST_SCRIPT_TIMEOUT_MS`, and a killed script fails at once with its name and time; locally, `QW_TEST_REUSE_DB=1` reuses the test database while migrations, seeds and module switches are unchanged (`pnpm ci:local` and CI always rebuild it), see [Backend testing · Faster tests](/backend/testing#加快测试) (Chinese).
- **Migration timestamp check**: `pnpm verify` refuses migration files with duplicate or malformed timestamps. Use the real current time, seconds included, for new migrations.

Upgrade:

- This release has 1 database migration that creates the access token and tool switch tables. **They are created whether or not the switch is on**. `pnpm db:seed` writes the **MCP tools** and **Access tokens** menus and the parameter `mcp.paused` (the menus stay hidden while the switch is off).
- New server environment variable `APP_MCP`, `false` by default; leave it unset if you don't need the module. For turning it on, see [Deploy · Agent access](/guide/deploy#智能体接入-mcp) (Chinese).
- One new server dependency, `@modelcontextprotocol/sdk` (1.32.1, MIT license), the official MCP package; `pnpm i` installs it.
- For OAuth2 clients, the reverse proxy must forward `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` to the server. Many nginx configurations block paths starting with a dot; let these two through before that rule, see [Deploy · Agent access](/guide/deploy#智能体接入-mcp) (Chinese). Not needed if you only use personal access tokens.
- For projects built from the template, see [Upgrading the template](/guide/upgrade) (Chinese) for merging the new release.
- Upgrade as usual: update to the v1.6.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese).

## 1.5.0 · 2026-10-20

Adds a WeChat Official Account management module, off by default. An **Official Account** is an official account a company or person runs inside WeChat; this module lets you manage one or more of them from the admin console. See [WeChat Official Accounts](/en/features/wxoa); for the full reference in the repository, see the [Official Account docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/wxoa.md) (Chinese).

Added:

- **Switch**: set `APP_WXOA=true` in the server environment to load the module, then restart. While off, the module is not loaded at all: every `/api/wxoa/*` route (including the callback that receives WeChat's pushes) returns 404, its scheduled tasks do not run, nothing calls WeChat, and its menus are hidden from the sidebar and the role grant tree.
- **Access and interaction**: several Official Accounts per tenant with write-only secrets; receiving WeChat pushes (plaintext, compatible and secure encryption modes, with signature and replay checks); message log and conversations with customer service replies; auto replies (including QR-scan replies); custom and conditional menus with a phone preview; fans, tags and blacklist with Excel export; permanent materials; template messages; channel QR codes that tag the fans who follow through them. This group has been verified on a WeChat test account.
- **Content and operations**: article drafts, publishing and publish records, mass messages (when the result of a send is unknown, it can be resent within WeChat's 24-hour de-duplication window), statistics charts, article comments and subscription notices. By WeChat's rules these need a verified service account; so far they have only been verified against a simulated WeChat API in tests.
- **Multi-tenancy**: each tenant manages its own Official Accounts; one AppID can be connected to one tenant only (with multi-tenancy on, adding an account first checks its AppSecret with WeChat); scheduled tasks handle each available tenant in turn; platform staff can look up which tenant holds an AppID.
- **Tests**: server test runs refuse a database and Redis database number pair that is not registered, and hold a run lock per test database, so two checkouts running tests at the same time no longer wipe each other's data.

Upgrade:

- This release has 4 database migrations that create the Official Account tables. **The tables are created whether or not the switch is on**; while it is off they stay empty. `pnpm db:seed` writes the module's menus, dictionaries, parameters and two scheduled tasks as usual (the two tasks are not scheduled while the switch is off).
- New server environment variable `APP_WXOA`, `false` by default; leave it unset if you don't need the module. For turning it on, see [Deployment · Official Account module](/guide/deploy#公众号模块) (Chinese).
- One new server dependency, `fast-xml-parser` (5.11.2), parses the XML that WeChat pushes; `pnpm i` installs it.
- Upgrade as usual: update to the v1.5.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese).

## 1.4.1 · 2026-10-20

UI polish, no functional changes.

Changed:

- **Dialog footers**: the button area is now a full-width light band at the bottom of the dialog with a divider above it; buttons are evenly spaced and wrap on narrow screens.
- **Table loading**: on first load a table shows its real header row above the placeholder rows; the "loading" text is read out only by screen readers.

Upgrade:

- Front-end styles only: no database migrations, no env or dependency changes. Upgrade as usual: update to the v1.4.1 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese). Projects that customized dialog styles should check the merge.

## 1.4.0 · 2026-10-15

A security release. The template went through a security review, and this release fixes the problems it confirmed, plus one date display bug. Read the upgrade notes below first: two of them may need action before you upgrade. For the full list of defenses in the repository, see the [security docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/security.md#威胁防护与测试入口) (Chinese).

Security:

- **Password resets and mobile changes are judged as grants**: resetting someone else's password, or setting their sign-in mobile number, hands you that account. So you must now be able to assign every role the user holds (disabled ones too), by the same rules as assigning roles; otherwise you get 403 with "This user holds roles you cannot grant: only an administrator who can grant them may reset the password or change the mobile". Before, a role with only the reset-password permission (such as a help desk) could reset users with more permissions; now it cannot. A tenant administrator is judged only on the permission codes it holds and the platform-only ones, so permission codes of disabled menus or menus outside the package in the user's roles do not block it. See [Privilege escalation guard](/en/features/permission#privilege-escalation-guard).
- **Moving a department is judged as a grant**: after a department moves under new parents, people there holding **Own department and below** roles can see it, so the move counts as a grant; beyond your own scope it gets 403 with "You cannot grant a role beyond your own permissions or data scope".
- **Login CSRF protection**: CSRF (cross-site request forgery) means another site making your browser send requests to this system. Password and SMS sign-in now refuse requests from another site, or with a `null` `Origin`, with 403 (error code `A1007`, "The request origin is not allowed"), so another site can no longer quietly sign its own account into your browser. Requests without an `Origin` header (apps, scripts) and mobile sign-ins are not affected.
- **Sign-in username format**: the username typed at sign-in must match the stored format (letters, digits and `_ . @ -`; full-width characters are folded to normal width first); other spellings get 400 and can no longer be used to probe whether an account exists.
- **Parallel password guesses**: of many password attempts sent at once, at most the lock threshold reach the password check; when the password was right but a later step failed, the attempt is not counted as a failure.
- **Excel import**: the file is rebuilt from its real structure, and the real unpacked size of every part is counted before parsing, so a file that lies about its sizes gets 400 ("The file is not a valid Excel (.xlsx) workbook") instead of exhausting memory.
- **Other**: dictionary and parameter reads ignore codes that do not match the code format (no cache entry per spelling); each user keeps at most 200 saved list settings, beyond that 409, and **Restore defaults** deletes that list's settings and frees a slot; presigned download links are masked in request logs; the log retention `audit.retention_days` can only be changed by the super administrator; disabled users no longer get WeChat subscribe message reminders.
- **Mobile H5 dev server**: serves only the app and shared sources, has CORS turned off, and answers only `localhost` and IP addresses; for `*.local` names or tunnel domains, set the environment variable `QW_H5_ALLOWED_HOSTS`. See [Mobile development · Debugging in the browser (H5)](/core/mobile#在浏览器里调试-h5) (Chinese).

Fixed:

- **Date columns**: `DATE` columns (such as a book's publication date) no longer come back a day early when the server process runs in a time zone behind UTC (west of UTC).

Upgrade:

- No database migrations, no dependency changes, and no changes to the server's environment variables. The new `QW_H5_ALLOWED_HOSTS` is only for the mobile H5 dev server and is set only when needed. `mobile/vite.config.ts` changed; if your project changed it, take care when merging.
- **Reverse proxy**: console password and SMS sign-in now check `Origin`. The reverse proxy must pass the browser's `Host` and scheme (http / https) to the server unchanged, or the console's address must be listed in `CORS_ORIGIN`; otherwise console sign-in answers 403 `A1007`. If you followed the nginx example in [Deploy](/guide/deploy#反向代理-nginx) (Chinese), the token refresh already needed this and nothing changes. See the repository's [deploy docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/deploy.md#nginx-反向代理与-csp) (Chinese).
- **Usernames that do not match the format**: accounts whose username does not match the stored format (letters, digits and `_ . @ -`; full-width characters folded first), such as Chinese login names imported directly with SQL, get 400 at sign-in after the upgrade. Rename these accounts to a matching username before upgrading.
- Then upgrade as usual: update to the v1.4.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese).

## 1.3.1 · 2026-10-15

A patch release that adds a switch for breakpoint debugging of the server during development.

Added:

- **Server breakpoint debugging**: start the dev server with `QW_INSPECT=1 pnpm dev` (PowerShell: `$env:QW_INSPECT=1; pnpm.cmd dev`) and only the server app process opens the Node inspector on `127.0.0.1:9229`, with source maps, so breakpoints go straight into the TypeScript sources; a port number (1024 to 65535) instead of `1` picks another port.
- **VS Code debug configurations**: the repository now commits `.vscode/launch.json`, with a server attach configuration **Server: attach (pnpm dev with QW_INSPECT=1)** that reattaches after every server restart, and two configurations that open the Vite dev server in Edge or Chrome for front-end debugging. See [Breakpoint debugging](/backend/breakpoints#后端) (Chinese).

Upgrade:

- Developer tooling only: no database migrations, no env or dependency changes; `QW_INSPECT` is set only when needed on a development machine and does not go into `.env`. The changed files are the dev start script `scripts/dev-server.mjs`, the new `.vscode/launch.json` and `.gitignore` (so that `.vscode/launch.json` can be committed); if your project changed these files, take care when merging. Upgrade as usual: update to the v1.3.1 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese).

## 1.3.0 · 2026-10-14

Adds job queues. A job queue hands slow work (such as building a report) to the background: a request only puts a **job** in the queue and returns, and a **processor** in the background picks it up and runs it. Queues are built on BullMQ and use the application's existing Redis; no separate message broker is needed. For the full description in the repository, see [Job queues](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md) (Chinese).

Added:

- **Job queues**: a module declares a queue with `registerQueue`, writes a processor extending `TenantJobProcessor`, and adds jobs with `QueueService.add`. Adding a job records the current tenant, and the job runs in that tenant; a job without a tenant fails at once without retries. By default a job is tried up to 3 times, with the wait doubling after each failure; the last 1000 completed and 5000 failed jobs are kept. A job runs at least once, so processors must be safe to run again. Every instance runs the processors and lets running jobs finish when it shuts down.
- **Queue monitor page**: **Monitoring → Queue monitor**, a platform page; with multi-tenancy on, only the platform root can open it. It shows each queue's job counts by state and whether it is paused, lists jobs by state (secret fields in job data are masked), and can retry failed jobs and remove jobs. Permissions are `monitor.queue.browse` / `retry` / `remove`; retries and removals are action-logged. The template itself registers no queue yet, so the page currently shows "No queue is registered yet". See [Monitoring and logs · Queue monitor](/features/monitor#队列监控) (Chinese).

Upgrade:

- No database migrations and no env changes. The server adds two dependencies, `bullmq` (^6.3.14) and `@nestjs/bullmq` (^12.0.0), which `pnpm i` installs. The new menu is written by the seed, so run `pnpm db:seed`.
- Check Redis before upgrading:
  - `maxmemory-policy` must be `noeviction`. Other policies evict keys when memory runs low, and queued jobs are lost silently. Set it in `redis.conf` (the application's account cannot run `CONFIG`); Homebrew installs use `noeviction` by default. If it is different, the application still starts and logs a warning.
  - The application's Redis ACL user needs the read-only `INFO` command (for example `+info` in the persistent ACL): every queue connection reads the Redis version, and start-up reads the eviction policy.
  - Each processor uses two more Redis connections per instance; leave room for them.
- Then upgrade as usual: update to the v1.3.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese).

## 1.2.1 · 2026-10-14

A patch release with two fixes.

Fixed:

- **Last sign-in time**: the last sign-in time shown after signing in no longer depends on the application and database clocks agreeing; sign-in log rows are now timestamped by the application. Sessions started before the upgrade show the correct time after their next sign-in.
- Three server tests no longer fail on Windows or on machines whose clock is off the database's.

Upgrade:

- Code only: no database migrations, no env or dependency changes. Upgrade as usual: update to the v1.2.1 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart, see [Deploy](/guide/deploy) (Chinese).

## 1.2.0 · 2026-10-14

Hand-written SQL can now apply data scope too. Data scope decides which departments' and which people's data someone can see; see [Permissions and data scope](/en/features/permission#data-scope). Queries built with `scopedQb` (the query builder that applies data scope) have always applied it automatically; SQL written by hand in the code does not go through it, so until now developers had to remember to add it themselves.

Added:

- **Data scope for hand-written SQL**: `dataScopeSql(alias, columns)` and `dataScopeSqlFor(entity, alias)` return the same department and owner condition as `scopedQb`, as a parameterized `{ sql, params }` to put straight into hand-written SQL.
- **A new check**: `pnpm verify` reports hand-written SQL that reads a data-scoped table but neither uses these functions nor carries the marker `qw:no-data-scope <reason>`; QueryBuilder calls that query or join such a table by its name as a string count too. SQL is never rewritten automatically. For how to write it, see [Hand-written SQL: dataScopeSql](/core/permission#手写-sql-datascopesql) (Chinese); for the full description in the repository, see [Data scope · Hand-written SQL](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/data-scope.md#手写-sql) (Chinese).

Upgrade steps:

- This release changes code only: there are no database migrations, and no environment variables or dependencies change, so you can roll back to 1.1.0. Upgrade as usual: update to the v1.2.0 code → `pnpm i` → `pnpm -r build` → `pnpm db:migrate` → `pnpm db:seed` → restart the service. See [Deployment](/guide/deploy) (Chinese).
- The template's own hand-written SQL is already covered. If your project has its own hand-written SQL that reads data-scoped tables (tables whose entity carries `@DataScoped`), `pnpm verify` reports these queries after the upgrade until they add the condition from `dataScopeSqlFor` / `dataScopeSql` or carry `qw:no-data-scope <reason>`. Add the condition when the result is shown to the current user (lists, dropdown options, exports, statistics on a page); add the marker for system queries such as sign-in or scheduled tasks.

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
