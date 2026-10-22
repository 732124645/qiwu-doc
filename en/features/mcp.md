---
description: 'Let agents (AI assistants) call the admin console as a user: the APP_MCP switch and the emergency stop parameter, the POST /api/mcp endpoint, personal access tokens and OAuth2, permissions and the action log, guardrails, sample tools, and the MCP tools and access tokens pages; off by default.'
---

# MCP agent access

An **agent** (also called an AI assistant) is a program that understands natural language and decides its own next step. Chatting is not enough: to look up data or get things done, it has to call functions that other systems offer. These functions are called **tools**. **MCP** (Model Context Protocol) is an open standard for how agents discover and call tools. An agent client that supports MCP connects with just an address and a token, with no custom integration code per system.

Qiwu can act as an MCP **server**: once an agent connects, it calls the console's tools **as a particular user**, for example to read the user's own profile, search users, or add a sample book. It can never do more than that user could do in the console.

::: tip Off by default
Agent access is off by default; projects that don't need it can skip this page. The template ships only the foundation and four sample tools; projects add their own tools as described in [Add MCP tools to a module](/core/mcp) (Chinese).
:::

## Turning it on

There are two switches:

| Switch | Where | Effect |
| --- | --- | --- |
| `APP_MCP` | Server environment variable, `false` by default | Read only at startup; restart **every** server instance after changing it. While off, the module is not loaded: `/api/mcp`, the discovery documents and all admin routes return 404, and the **MCP tools** and **Access tokens** pages are hidden from the sidebar and the role grant tree |
| `mcp.paused` | **System → Parameters**, `false` by default, **only the super administrator (root) can change it** | The emergency stop while running. Set to `true`, every tool call is refused at once (the tool list still works and tokens are kept); set back to `false` to resume. No restart needed; it takes effect on all instances together |

The tables (access tokens, tool switch records) are created by the database migrations whether or not the switch is on, so turning it on needs no extra migration. For deployment notes see [Deploy · Agent access](/guide/deploy#智能体接入-mcp) (Chinese); the full reference is the repository's [Enabling](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#启用) section (Chinese).

## Endpoint

Agents connect to one address: `POST /api/mcp`, for example `https://your-domain/api/mcp`.

- It offers **tools** only: initialize, list tools (`tools/list`) and call a tool (`tools/call`). Other MCP capabilities such as resources and prompts are not offered;
- It is **stateless**: each request is handled on its own; the server keeps no session and pushes nothing;
- The tool list contains only the tools the token **can actually use** right now: the tool is enabled, the token allows it, it has write permission (for write tools), and the user holds the tool's permission code.

For protocol details see the repository's [Endpoint and protocol](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#端点与协议) (Chinese).

## Two ways to connect

Every agent call carries a **token** that shows which user it acts for. Tokens come from two places.

### Personal access tokens

The simplest way, for agents a person uses for themselves. Users create them on the **Access tokens** tab of **My profile**:

- Creating one asks for your **current password** again;
- The token is **shown only once**, when it is created; after closing the dialog it cannot be seen again, so copy it right away. The system stores only a digest and the last 4 characters; a lost token can only be revoked and replaced;
- **Valid for**: the page offers 7, 30 or 90 days, or never expires (the API accepts 1 to 90 days, or no expiry);
- **Tools**: you can pick some tools only; picking none means all tools, including tools added later;
- **Allow write tools**: tools that add or change data are **write tools**; they need this switch, otherwise only read tools can be used;
- Each user can have at most 20 active tokens;
- You can **revoke** a token at any time; it takes effect at once and cannot be undone.

A user's tokens become **permanently invalid** (re-enabling the account does not bring them back) when the user is disabled or deleted, changes or has their password reset, is signed out by an administrator, or is locked after too many wrong passwords; or when the tenant is disabled or its expiry date is moved to before now. Changing the mobile number or unlinking WeChat does not affect tokens.

See the repository's [Personal access tokens](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#个人访问令牌) (Chinese).

### OAuth2

For agent services built by a third party. It reuses [Single sign-on (OAuth2)](/en/features/oauth): an administrator registers the agent's backend in **System → OAuth2 clients** and ticks the two new scopes; after the user agrees on the authorization page, the agent gets a token that acts for that user.

| Scope | Effect |
| --- | --- |
| `mcp` | Read tools may be called. Only tokens carrying it can reach `/api/mcp`, and they reach nothing else |
| `mcp.write` | Together with `mcp`: write tools may be called too, adding or changing data for the user |

Both scopes are unticked by default and granted explicitly by an administrator only when registering an agent client. As with single sign-on, only **confidential clients** with their own backend that can keep a client secret are supported; dynamic client registration is not supported, and public clients without a secret are not served. Many desktop agent clients rely on these two for OAuth sign-in; use a personal access token with them instead.

See the repository's [OAuth2](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#oauth2) section (Chinese).

## Running as the user

Whichever token is used, every call runs with **the token's own user's** rights:

- **Permission codes** and **data scope** are exactly those the user has in the console, and role or menu grant changes take effect at once; see [Permissions and data scope](/en/features/permission);
- With [multi-tenancy](/en/features/multi-tenancy) on, calls run only in the user's own tenant; the identity and the tenant come only from the token. Platform staff cannot use the "entered a tenant" state over MCP;
- A token of the super administrator (root) carries all of root's rights, so issue one with care;
- Every call (refused ones too) writes a row to **System → Logs → Action log** with the action **Agent call**, marked as done by an agent on the user's behalf, with the token used; arguments named like passwords or keys show as `***`. Data the tool changes records the user as creator or modifier as usual.

## Guardrails

Each call passes these checks in order; if any fails, nothing runs:

| Check | Details |
| --- | --- |
| Rate limit | At most 60 calls per token per minute (all instances together), and 600 requests per source IP per minute |
| Emergency stop | Everything is refused while the parameter `mcp.paused` is `true` |
| Argument size | Arguments nested deeper than 32 levels or larger than 16 KiB are refused without validation or running |
| Tool switch | The tool was switched off on the **MCP tools** page |
| Token limits | The token does not list the tool; or it is a write tool and the token does not allow writes |
| Permission code | The user lacks the tool's permission code, or the tenant package does not include it |
| Argument validation | Arguments that don't match the tool's declared format are refused with the failing fields |
| Timeout | Each tool has a time limit (30 seconds by default, at most 120 seconds) |
| Output | Fields in the result named like passwords, tokens or keys are masked as `***`; results over 64 KiB are not returned |

When a write tool times out, the agent gets the timeout error at once, but the write that had started may still complete. So after a timeout the agent should check first, then decide whether to retry.

See the repository's [Guardrails and audit](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#护栏与审计) (Chinese).

## Sample tools

The template ships four sample tools:

| Tool | Kind | Needs | What it does |
| --- | --- | --- | --- |
| `iam.me.get` | Read | Any signed-in user | The token's own user: username, name, department, roles, positions, language |
| `iam.user.search` | Read | The browse permission of Users | Search users by keyword, department and status, at most 50 per page; the same query as the user list, with the same data scope and mobile number masking |
| `cfg.dict.options` | Read | Any signed-in user | The options of an enabled dictionary, labels in the request's language |
| `demo.book.create` | Write | The create permission of the sample books | Add a sample book under the same rules as the page's Add (department data scope, uniqueness, creator) |

See the repository's [Sample tools](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#示例工具) (Chinese).

## Admin pages

With the switch on, **System** gets two more pages:

- **System → MCP tools**: lists every registered tool (readable name and tool identifier, kind, permission, purpose description), with the MCP endpoint address at the top. You can **switch off** a tool as a whole, for every tenant and token. With multi-tenancy on this is a **platform-only page**, usable only by the default tenant (the platform);
- **System → Access tokens**: the access tokens of every user in the tenant (filter by user, name and state), which you can revoke. The token itself is never shown, only its last 4 characters.

The buttons of both pages are granted in **System → Roles → Menu permissions**: MCP tools has browse and modify, Access tokens has browse and revoke. The **Access tokens** tab in My profile is available to every signed-in user without a grant.

Since v1.9.1, registered tool names and purpose descriptions, and known permission names, follow the page language. Identifiers remain available for reference, and the personal access token selector uses readable tool names too. Unknown tools and permissions keep their original text. The display does not change the identifiers, arguments or permission checks used by `tools/list` and `tools/call`.

## Configuring a client

Any client that supports MCP's **Streamable HTTP** transport and custom request headers can connect. With a personal access token, roughly:

1. Create a token on the **Access tokens** tab of My profile and save it;
2. In the client's MCP server settings, enter the address `https://your-domain/api/mcp` and choose the HTTP transport;
3. Add the request header `Authorization` with the value `Bearer ` followed by the token;
4. Ask the agent to list its tools and check that the expected ones are there.

For a configuration file example and test commands, see the developer guide's [Add MCP tools to a module · Configuring a client](/core/mcp#配置客户端) (Chinese) and the repository's [Client configuration example](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#客户端配置示例) (Chinese).

## Trying it on the demo site

The [live demo](/en/guide/introduction#live-demo) does **not** turn on agent access. The demo runs in demo mode, which refuses writes, so no access token can be created there. To try it, turn on `APP_MCP` in your own installation. Also, an installation in demo mode (`APP_DEMO_MODE=true`) refuses `POST /api/mcp` like any other write route, even with `APP_MCP` on.

## Known limitations

- Tools only, no resources, prompts or other MCP capabilities; the server pushes nothing, so clients re-read the tool list after it changes;
- A timeout only ends the waiting; database work that has started cannot be interrupted;
- OAuth2 supports neither dynamic client registration nor public clients;
- Masking in the log goes by field name: fields whose names contain words like `key`, `token` or `pass` (for example `keyword`) also show as `***`. This is a deliberately cautious rule.

For the full list see the repository's [Known limits](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#已知上限) (Chinese).

Related features:

- [Single sign-on (OAuth2)](/en/features/oauth)
- [Permissions and data scope](/en/features/permission)
- [System management · My profile](/en/features/system#my-profile)
- [Add MCP tools to a module](/core/mcp) (developer guide, Chinese)
