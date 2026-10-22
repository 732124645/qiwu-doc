---
description: 'The in-app assistant: staff ask a model / agent in plain language to look up data, search the web and change data, and every change is confirmed by a person first. The APP_AGENT switch, model setup (OpenAI-compatible APIs), web search, external MCP servers, tool policies and approval modes, clarifying questions, skills, instructions and prompt templates, limits and the emergency stop, usage, batch runs and the security model; off by default.'
---

# Assistant

The **assistant** is a chat page in the admin console. Staff state what they need in plain language, and the model / agent does it **with the console's own tools, as that user**: looking up data, summarizing, changing data as asked; when it needs outside information, it searches the web and reads pages. Whenever data would change, it first lists which record, each field's current → proposed value and the sources it relied on, and **runs the change only after a person confirms it**.

You can also tick several records in a list and have the agent run the same skill on each of them (for example 补齐客户信息, "fill in customer details"); the results go to a batch review page where you confirm them one by one or all at once.

The agent acts only through tools: the modules' existing MCP tools (the same tool list and the same checks as [MCP agent access](/en/features/mcp)), plus built-in tools for the web, a plan checklist and clarifying questions. It runs no commands, reads or writes no files on the server and drives no browser.

::: tip Off by default
The assistant is off by default; projects that don't need it can skip this page. It runs on the existing Redis job queue and Socket.IO push, so no new service is needed. The full reference is the repository's [in-app agent docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md) (Chinese).
:::

## Turning it on

| Switch | Where | Effect |
| --- | --- | --- |
| `APP_AGENT` | Server environment variable, `false` by default | Read only at startup; restart **every** server instance after changing it. While off, the module is not loaded: every `/api/agent/*` route returns 404, the **Agent** menu group is hidden from the sidebar, the role grant tree and tenant packages, and the button in the lower-right corner does not appear |
| `agent.paused` | **System → Parameters**, `false` by default, **only the super administrator (root) can change it** | Emergency stop: set to `true`, new turns and tool calls are refused and running turns stop within half a second; set back to `false` to resume. No restart needed; it takes effect on all instances together |

`APP_AGENT` and `APP_MCP` are independent: with only the assistant on, `/api/mcp` still does not exist. The tables are always created by the migrations and the menus and sample data always written by the seeds, so turning it on needs no extra migration. For deployment notes (outbound firewall, keys) see [Deploy · Assistant](/guide/deploy#智能助手) (Chinese).

First steps after turning it on:

1. The super administrator adds a model provider on the **Models** tab of **Agent → Agent settings** (see the next section). Without a usable model, the chat page asks you to contact an administrator and the input box is disabled;
2. For web access, add a search provider on the **Web search** tab;
3. In **System → Roles**, grant **Assistant** to the business roles; the skills, batch run and usage pages are granted separately;
4. With [multi-tenancy](/en/features/multi-tenancy) on, tick the **Agent** menu group into the tenant package first; only then can the tenant's roles be granted it.

The **Agent** menu group comes right after Home and has four pages:

| Page | Content |
| --- | --- |
| **Agent → Assistant** | The chat page. The batch review page sits under it and is not shown in the menu |
| **Agent → Skills** | Personal and tenant-wide skills, prompt templates, tenant instructions |
| **Agent → Agent settings** | Models, web search, external MCP, tool policies, platform skills, instructions and limits. With multi-tenancy on it is a platform-only page, and only the super administrator can change it |
| **Agent → Agent usage** | Calls and tokens summed by day, user or model |

See the repository's [Enabling](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#启用) section (Chinese).

## Models

Models connect through an **OpenAI-compatible API** (Chat Completions), so common hosted model services and a local Ollama all work. On the **Models** tab of **Agent → Agent settings**, each provider has a name, an API address, a key and the models it offers, and can be made the default. For each model you can also mark whether it supports reasoning effort (low, medium or high in the chat), whether it can read images, and how large its context window is.

| Service | Notes |
| --- | --- |
| DeepSeek, Qwen (Alibaba Cloud Model Studio), Kimi (Moonshot AI), Zhipu, OpenAI | Enter the vendor's API address and a key from its console |
| Ollama | Runs on the same machine or the internal network; leave the key empty |

- The agent relies on the model's **tool calling** (function calling); pick a model that supports it;
- Keys are **write-only**: encrypted in the database, and the page shows only **Stored**. Changing the API address requires entering the key again; the old key is never sent to a new address;
- Each conversation can pick one of the configured models; without a choice it uses the first model of the default provider;
- When a model service fails, the page shows only that the call failed and a short reason, never the service's raw reply.

API addresses and sample model names for each vendor are in the repository's [model setup](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#配置模型) section (Chinese).

## Web search

The agent has two built-in read-only web tools: one searches the web, one reads a page.

- Search providers are **Bocha** (for China) and **Tavily** (outside China), added on the **Web search** tab; their keys are also encrypted and write-only. Without a search provider, no search is offered;
- The page reader **can only read** links that appeared in this turn's search results, links the user gave in a message, or sites an administrator allowed. This keeps web content from tricking the agent into putting internal data into a URL;
- Setting the parameter `agent.web.mode` to `off` removes all web tools.

See the repository's [web search](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#联网搜索) section (Chinese).

## External MCP servers

On the **External MCP** tab you can connect MCP servers outside this system (Streamable HTTP transport) so the agent can use their tools too.

- Authentication can be none, a header token, or OAuth client credentials; credentials are encrypted and write-only;
- Only public addresses are allowed by default; pointing at an internal address must be allowed explicitly by the super administrator;
- **Sync** lists the server's tools. New tools start **disabled**; an administrator enables them one by one and sets each one's approval policy. A server calling a tool read-only is not trusted: only tools an administrator explicitly sets to run directly skip confirmation;
- When a server asks the user for more information during a call, the chat page shows a form card.

See the repository's [external MCP servers](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#外部-mcp-服务器) section (Chinese).

## Tool policies and approval modes

The **Tool policies** tab lists every tool of this system with an approval policy, applied to all tenants:

| Policy | Meaning |
| --- | --- |
| Run directly (`auto`) | Default for read-only tools |
| Ask (`ask`) | Stop and wait for the requester to confirm; default for write tools |
| Deny (`deny`) | The agent does not see the tool |

A write tool can only be **Ask** or **Deny**, never run directly. A tool switched off as a whole on the MCP tools page cannot be used by the agent either.

Each conversation can also switch its **approval mode**:

- **Read only**: only read-only tools are offered;
- **Ask** (default): every write is confirmed;
- **Trust this conversation**: once a tool has been confirmed for a record, it is not asked again for that record in this conversation. The super administrator can turn this option off with the parameter `agent.trust_mode`.

The approval card shows the tool, the record, each field's current → proposed value and the sources read in this turn, with the buttons **Approve**, **Approve for this conversation**, **Reject** and **Cancel turn**. You can add a reason when rejecting, and the agent will not retry. Whatever the mode, **a write never runs without a person confirming it**.

There is also a **plan mode**: the agent stays read-only and lists its steps first; you confirm, then switch back to run them.

See the repository's [tool policies](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#工具策略) and [chat page](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#对话页) sections (Chinese).

## Clarifying questions and options

When the agent is unsure (for example, it finds several companies with similar names), it stops and asks you: 1 to 4 questions at a time, each with 2 to 4 options (single or multiple choice) plus **Other** to type your own answer. The turn waits for your answer, and you may also choose not to answer. What you type is passed to the model as data only.

## The chat page

**Agent → Assistant** works much like a desktop chat app:

- **Conversation list**: create, search (titles and full message text), rename, pin, archive and delete, filtered by all, running, unread or pinned; temporary conversations stay out of the list and are deleted when you leave;
- **Answers** stream in, with collapsible tool calls; supported models show a reasoning summary; cited pages are listed at the end, followed by a few suggested follow-ups;
- **Fork, resend and revert**: fork a new conversation from any message, or edit and resend the last one; **revert** removes the last turn, but **changes it already made are not rolled back**;
- **Share and export**: a read-only link that only people in the same tenant can open; export as Markdown;
- **Sending while a turn runs**: **Add to this turn** to change direction, or **Queue for next turn**; you can press **Stop** at any time;
- **Attachments**: files already uploaded to file storage; text files, the first sheet of an xlsx and images (for models that read images) are passed to the model;
- **Slash commands**: type `/` to start a conversation, compact the context, switch the model, the approval mode or plan mode, pick a skill, insert a prompt template, see usage and more;
- **Reminders**: an inbox message when a turn waits for your confirmation or answer, or when a long turn finishes;
- **Corner button**: the **Assistant** button in the lower-right corner of every page opens the chat with the current page; on a list page the agent also knows which rows you ticked.

See the repository's [chat page](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#对话页) section (Chinese).

## Skills

A **skill** is a task description plus the tools that task may use. For example, 补齐客户信息 ("fill in customer details"): look up each company's website, industry, city and so on, fill only empty fields, and cite the sources. A skill is only text; it contains no executable code.

| Scope | Maintained by | Used by |
| --- | --- | --- |
| Platform | The super administrator, on the **Platform skills** tab of **Agent settings** | Every user of every tenant |
| Tenant | People with the skill management permissions, in **Agent → Skills** | Users of the tenant |
| Personal | You, in **Agent → Skills** | You |

With equal names, the personal skill wins, then the tenant's, then the platform's.

- The model normally sees only each skill's name and description and loads the full text when it decides to use it;
- Type `$` and the skill name in the input box (or use `/skills`) to pick a skill directly; if the skill lists tools, only those tools are offered in that turn;
- After a good conversation, **Save as skill** has the model draft a personal skill from it; the draft is saved disabled, so you check it and then enable it;
- Skills can be imported and exported as `SKILL.md`.

For the format and how to write one, see the repository's [skills](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#技能) section (Chinese).

## Instructions, tone and prompt templates

- **Instructions** are added to the model's system prompt in this order: platform instructions (super administrator) → tenant instructions (on the **Skills** page) → personal instructions (each user's own, for example "answer with tables");
- **Tone** is a personal choice: Default, Concise, Detailed, Friendly, Formal;
- **Prompt templates** are saved questions, personal or tenant-wide, inserted with `/prompts` in the input box.

See the repository's [instructions, tone and prompt templates](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#说明语气与提示词模板) section (Chinese).

## Limits, emergency stop and usage

The super administrator limits cost with system parameters: steps, time and tokens per turn, tokens per user and per tenant per day, and concurrent turns per user. When a limit is hit, the turn stops and says which limit it reached. The emergency stop `agent.paused` is described above.

Usage is recorded by user, tenant, model and date: **Agent → Agent usage** sums the current tenant's calls and input / output tokens by day, user or model; `/status` in the chat shows this conversation's context use and the usage and limits for this turn and today.

Parameters and defaults are in the repository's [limits, emergency stop and usage](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#限额急停与用量) section (Chinese).

## Batch runs and the "fill in customer details" sample

The template ships a sample: **Generator samples → Sample customers** holds a few well-known companies with some fields left empty on purpose, and the platform skill 补齐客户信息 comes with three tools (search customers, read a customer, update a customer).

- Ask in the chat, for example "fill in the industry of 华为技术有限公司";
- Or tick a few customers in the sample customer list and click **Let the agent fill in**: one conversation per customer, started in turn within the requester's concurrency limit, with every change stopping for approval;
- The batch review page lists each row's state and pending changes; confirm them one by one, or **Approve all** / **Reject all**.

Batch runs are granted separately and can only cover records you can see. To make your own list batchable, see the repository's [adding tools, batch targets and skills to your module](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#给自己的模块加工具批量目标与技能) and the [sample](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#批量执行与补齐客户信息示例) (Chinese).

## Security model

- **Owned by the requester**: conversations, approvals and questions can be seen and acted on only by their owner; anyone else gets 404, and only the requester can confirm a change;
- **Runs as the user**: tools keep MCP's checks (permission, data scope, tenant and package, argument validation, time limit, masking of secret-named output fields). The agent can never do more than the requester could do on the pages; each turn reloads the requester's identity first and stops if the user was disabled or deleted;
- **Writes need a person**: if permissions, the approval mode or the policy changed after confirmation, the call is still blocked;
- **Outside content is untrusted**: web pages, search results and external MCP output are passed to the model as data only. Even if a page talks the model into changing data, the change stops at the approval card, which lists the sources;
- **Outbound requests go to public addresses only**: page reading and external MCP connect only to public addresses and recheck every redirect. The model's API address is not checked this way (so a local or internal Ollama works) and only the super administrator can set it;
- **Encrypted keys**: credentials of models, search providers and external MCP servers are encrypted with a key derived from `APP_SECRET` and are write-only; enter them again after changing `APP_SECRET`;
- **Audit**: every tool call (refused ones too) writes a row to **System → Logs → Action log**, marked as coming from the chat page; changed data records the requester as modifier as usual.

See the repository's [security model](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#安全模型) section (Chinese).

## Try it on the live demo

The [live demo](/en/guide/introduction#live-demo) does **not** have the assistant turned on. To try it, turn on `APP_AGENT` on your own installation and configure a model.

## Known limits

- The concurrent turn limit is soft: requests arriving together may give a user one extra turn;
- Models, search providers and external MCP servers are platform settings; tenants cannot add their own external MCP servers yet;
- Only remote HTTP MCP servers are supported, not stdio servers that need a process started on the server;
- Reverting a turn does not roll back changes it made; a tool timeout only ends the wait, and a database operation already started cannot be interrupted;
- The model's answers and judgment can be wrong: check each current → proposed value and source on the approval card.

The full list is in the repository's [known limits](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#已知上限) section (Chinese).

Related:

- [MCP agent access](/en/features/mcp)
- [Permissions and data scope](/en/features/permission)
- [Multi-tenancy](/en/features/multi-tenancy)
- [Security baseline](/en/features/security)
