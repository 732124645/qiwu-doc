---
description: 'The in-app assistant: staff ask a model / agent in plain language to look up data, search the web and change data, with human confirmation before changes by default. The APP_AGENT switch, model setup (OpenAI-compatible APIs), web search, external MCP servers, conversation modes and tool policies, plan mode, clarifying questions, skills, instructions and prompt templates, profiles, memory, automatic review, automations, sub-agents and deep research, charts and exports, limits and the emergency stop, usage, diagnostics, batch runs and the security model; off by default.'
---

# Assistant

The **assistant** opens beside the current business page from the floating button on the right. Staff state what they need in plain language, and the model / agent does it **with the console's own tools, as that user**: looking up data, summarizing, changing data as asked; when it needs outside information, it searches the web and reads pages. In the default **Ask** mode, it first lists which record, each field's current → proposed value and the sources it relied on, and **runs the change only after a person confirms it**. Users can authorize some writes without repeated confirmation under the rules for [conversation modes](#conversation-modes-and-tool-policies), [automatic review](#automatic-review) and [automations](#automations).

You can also tick several records in a list and have the agent run the same skill on each of them (for example 补齐客户信息, "fill in customer details"); the results go to a batch review page where you confirm them one by one or all at once. A skill or a prompt can also become an **automation** that runs in the background on a schedule, after a business action or on demand, with its results in your inbox.

The agent acts only through tools: the modules' existing MCP tools (the same tool list and the same checks as [MCP agent access](/en/features/mcp)), plus built-in tools for the web, a plan checklist and clarifying questions. It runs no commands, reads or writes no files on the server and drives no browser.

::: tip Off by default
The assistant is off by default; projects that don't need it can skip this page. It runs on the existing Redis job queue and Socket.IO push, so no new service is needed. The full reference is the repository's [in-app agent docs](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md) (Chinese).
:::

## Turning it on

| Switch | Where | Effect |
| --- | --- | --- |
| `APP_AGENT` | Server environment variable, `false` by default | Read only at startup; restart **every** server instance after changing it. While off, the module is not loaded: every `/api/agent/*` route returns 404, the **Agent** menu group is hidden from the sidebar, the role grant tree and tenant packages, and the floating button on the right does not appear |
| `agent.paused` | **System → Parameters**, `false` by default, **only the super administrator (root) can change it** | Emergency stop: set to `true`, new turns and tool calls are refused and running turns stop within half a second; set back to `false` to resume. No restart needed; it takes effect on all instances together |

`APP_AGENT` and `APP_MCP` are independent: with only the assistant on, `/api/mcp` still does not exist. The tables are always created by the migrations and the menus and sample data always written by the seeds, so turning it on needs no extra migration. For deployment notes (outbound firewall, keys) see [Deploy · Assistant](/guide/deploy#智能助手) (Chinese).

First steps after turning it on:

1. The super administrator adds a model provider on the **Models** tab of **Agent → Agent settings** (see the next section). Since v1.12.0, a **Getting started** guide at the top of the settings page shows the state of each step in order (model, web search, tool approval, try it), and the tabs follow the same order. Without a usable model, the chat page asks you to contact an administrator and the input box is disabled;
2. For web access, add a search provider on the **Web search** tab;
3. In **System → Roles**, grant **Assistant** to the business roles; the skills, batch run, usage and automations pages are granted separately;
4. With [multi-tenancy](/en/features/multi-tenancy) on, tick the **Agent** menu group into the tenant package first; only then can the tenant's roles be granted it.

Since v1.11.0, chat opens from the floating button, without a sidebar menu item. Settings, skills, usage and automations remain in **Agent**. The hidden conversation routes remain available for grants, notices, sharing and existing links:

| Page | Content |
| --- | --- |
| **Floating Assistant button** | Chat beside the current page; conversation and batch-review routes remain hidden from the sidebar |
| **Agent → Skills** | Personal and tenant-wide skills, prompt templates, tenant instructions |
| **Agent → Agent settings** | A getting-started guide, then models, web search, external tools (MCP), tool approval, platform skills, rules and quotas, plus a **Diagnostics** tab for the super administrator only. With multi-tenancy on it is a platform-only page, and only the super administrator can change it |
| **Agent → Agent usage** | Credits and actual usage by day, user or model, with paginated per-call rate snapshots |
| **Agent → Automations** | Skills and prompts run in the background on a schedule, after a business event or by hand, with their run history; see [Automations](#automations) below |

See the repository's [Enabling](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#启用) section (Chinese).

## Models

Models connect through an **OpenAI-compatible Chat Completions API**. On **Agent → Agent settings → Models**, enter the provider name, base URL, key and model list; one provider can be the default. Choose a model that supports **function calling**. Leave the key empty for a local service that needs none.

Since v1.11.0, every model also needs explicit credit rates, measured as **credits per million tokens**, without a currency or exchange rate:

| Rate | What is charged |
| --- | --- |
| Ordinary input | Input outside any separately priced cache portion |
| Output | The provider's reported output total, including its reasoning portion |
| Cache read | Replaces the rate for that input portion; it is not added to the input total again |
| Cache write | Replaces the rate for that input portion; it is not added to the input total again |

- A blank cache rate inherits ordinary input. Explicit `0` means free for that category. Rates have up to six decimal places; exact integer arithmetic rounds once after adding up a call.
- Since v1.12.0, a model without rates (including models from before the upgrade) keeps working and is marked **No rates configured** in settings. Its calls are recorded as **unpriced**: they are not charged in credits and not limited by credit budgets, which does not mean they are free; the usage page lists them separately. Add rates and budgets where credits should apply. An invalid rate is still refused.
- Since v1.12.0, a model with rates is always charged: when the provider omits cache details, all input is charged at the highest of the input, cache-read and cache-write rates; a total that disagrees is priced from input plus output; unknown usage is estimated (see [Limits, emergency stop and usage](#limits-emergency-stop-and-usage)).
- Since v1.12.0, a model service that rejects explicitly turning thinking off returns a dedicated error instead of a generic upstream failure, without retrying with another value. Pick another effort, or set the default to provider default or the vLLM switch.
- Reasoning is part of output, and cache is part of input. Their detail counters must not be added to the totals a second time.
- Model capability and default thinking behavior are separate: provider default, explicitly off, or a supported effort. The standard protocol sends supported reasoning parameters; vLLM mode presents only on/off, without inventing low/medium/high levels. Removing a capability declaration is not an instruction to turn thinking off upstream.
- Keys are encrypted and **write-only**. Changing a base URL requires the key again, so the old key is never sent to the new address.
- Since v1.13.0, once the base URL and key are filled in, **Load models from service** reads the provider's model list (`GET {base URL}/models`) and you add models from a searchable picker instead of typing identifiers; with a stored key and an unchanged address it loads directly. A stored key is only sent to the stored address, redirects are not followed and the response size is capped. Super administrator only.
- A conversation can select its configured provider and model. Errors show only a short reason, without the provider's response body or key.

For base URLs, context windows, image capability and settings, see the repository's [model configuration](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#配置模型) section (Chinese).

## Web search

The agent has two built-in read-only web tools: one searches the web, one reads a page.

- Search providers are **Bocha** (for China) and **Tavily** (outside China), added on the **Web search** tab; their keys are also encrypted and write-only. Without a search provider, no search is offered;
- The page reader **can only read** links that appeared in this turn's search results, links the user gave in a message, or sites an administrator allowed. This keeps web content from tricking the agent into putting internal data into a URL;
- Setting the parameter `agent.web.mode` to `off` removes all web tools.

See the repository's [web search](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#联网搜索) section (Chinese).

## External MCP servers

On the **External tools (MCP)** tab you can connect MCP servers outside this system (Streamable HTTP transport) so the agent can use their tools too.

- Authentication can be none, a header token, or OAuth client credentials; credentials are encrypted and write-only;
- Only public addresses are allowed by default; pointing at an internal address must be allowed explicitly by the super administrator;
- **Sync** lists the server's tools. New tools start **disabled**; an administrator enables them one by one and sets each one's approval policy. an external server calling a tool “read only” is not trusted; only a tool the super administrator explicitly sets to run directly needs no confirmation. An unknown hint still requires checking the named server and tool before trusting it; this is a manual trust decision, not proof that the system verified it as read-only;
- When a server asks the user for more information during a call, the chat page shows a form card.

See the repository's [external MCP servers](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#外部-mcp-服务器) section (Chinese).

## Conversation modes and tool policies

Since v1.9.1, registered tools have names and purpose descriptions in the page language, together with readable names for known permissions. Tool identifiers remain available for reference; unknown tools and permissions keep their original text. This changes only the display: protocol names and arguments stay the same.

Since v1.13.0, each conversation has one **mode**, which replaces the former approval dropdown, the plan switch and **Trust this conversation**. Pick it in the mode selector of the composer (or with `/approvals`); Shift+Tab in the composer cycles through the available modes:

| Mode | Meaning |
| --- | --- |
| Read only | Only reads data, never changes it and never asks |
| Plan | Also read only; the agent ends with a plan card and runs nothing until you approve it, see [Plan mode](#plan-mode) below |
| Ask every time (default) | Reads run at once; you are asked before every write |
| Auto review | Only when the platform has a review model: writes that need confirmation go to the review model first, and you are asked only when it is unsure or a call is risky, see [Automatic review](#automatic-review) below |

The **Tool approval** tab lists every tool of this system with an approval policy, applied to all tenants:

| Policy | Meaning |
| --- | --- |
| Run directly (`auto`) | Default for read-only tools; no confirmation |
| Needs confirmation (`ask`) | Default for write tools: in **Ask every time** the requester confirms, in **Auto review** the review model judges first. A read-only tool set to this asks a person in every mode and is never reviewed |
| People only (`human`) | Only the requester confirms, on the card, each time: never reviewed and never allowed for the rest of the conversation. Recommended for deleting, bulk changes, sending outside the system and money |
| Off (`deny`) | The agent does not see the tool |

System write tools can only be **Needs confirmation**, **People only** or **Off**, never run directly. **Restore default** sets write tools that the developer declared high-risk to **People only** and other write tools to **Needs confirmation**. Direct execution of external tools depends on the super administrator's explicit trust described above. Tools declared to require personal confirmation every time keep that requirement. A tool switched off as a whole on the MCP tools page cannot be used by the agent either.

### Approval cards

The approval card shows the tool, the record, each field's current → proposed value and the sources read in this turn, with these buttons:

- **Allow once**: runs this call only;
- **Don't ask again for “tool” in this conversation**: the tool then runs directly in this conversation, without a card and without review. Allowed tools are listed in **Conversation settings** and can be revoked one by one; an allowance is checked against the current policy when it is recorded and before every use, so it stops working once an administrator sets the tool to **People only** or turns it off. Switching modes keeps allowances, a fork does not inherit them, and reverting a turn removes the ones it recorded. Tools that need personal confirmation, tools set to **People only** and external MCP tools never offer it; external tools always ask;
- **Reject**: you can add a note, and the agent will not retry the same call.

Sending a message while cards wait means “reject with this note”: every pending card of the step, and the calls of that step that would ask, are rejected with your message, and the agent continues at once. **Stop** is always available. In auto review mode, a card that waits for you without review says why, for example the tool is set to **People only** or the platform has no review model.

Apart from tools allowed for the conversation, writes that need confirmation approved by the review model after you chose auto review mode, and an automation's [pre-approval](#automations), which you gave with your password, **every write is confirmed by a person each time**.

See the repository's [tool policies](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#工具策略) and [chat panel](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#聊天面板) sections (Chinese).

## Office requests

::: info Version scope
Office assistant application tools were publicly released in [v1.10.0](https://github.com/732124645/qiwu-vue-admin/tree/v1.10.0). The v1.11.0 public composition keeps basic requests and the existing approvals but does not include those application tools. This historical entry acknowledges what was already published.
:::

In v1.10.0, every prepared request required the owner's individual confirmation click; conversation trust, automatic review, automation pre-approval, bulk approval and direct MCP / PAT could not replace it. Use [Office requests](/en/features/oa) and the approval center directly in the current public distribution.

## Automatic review

Automatic review lets writes skip waiting for a click: another model (the review model) looks at each one first.

1. The super administrator names the review model in the system parameter `agent.review.model`; without it, conversations have no auto review mode;
2. The requester switches the conversation to **Auto review**. Since v1.13.0 it takes effect as soon as it is selected, without per-tool opt-in: every write set to **Needs confirmation** goes to review first.

There are three outcomes: **approve** (runs at once; the card says **Approved by automatic review** with the reason), **reject** (does not run; the card waits for you with the reviewer's reason, and you can still confirm or reject it, so a rejection is not sent back to the agent on its own) or **hand over** (waits for you as usual, with the review's note on the card). Writes set to **People only**, tools that need personal confirmation, and the read only and plan modes are never reviewed; tools allowed for the conversation run directly. A review model error or timeout, an answer in the wrong format, content too long to pass without truncation, 10 reviews already in the turn, the same tool rejected twice in the turn, an exhausted credit budget and similar cases all go to a person; nothing is ever approved by default. The review model sees only what you said in the conversation, the tool, its arguments, the change preview and the source links, never any tool output or page text.

::: warning Limitations
The review model can be wrong too, or be misled by crafted arguments, business data or context; it can only compare against what you said in the conversation, does not understand business rules, and does not replace permissions or data scope (the tool still runs with the requester's own permissions). Before offering auto review, the super administrator should go through the write tools on **Tool approval** and set those that delete, change many records, send outside the system or move money to **People only**; they are never reviewed. Every approval is recorded on the approval card and in the action log for later checks.
:::

See the repository's [automatic review](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#自动审查) section (Chinese).

## Plan mode

Since v1.13.0, in plan mode the agent uses read-only tools only and asks you when a decision is yours; when the plan is ready it proposes a **plan card**: title, summary, numbered steps, the data it expects to change and its assumptions. The turn waits for your choice:

| Option | Result |
| --- | --- |
| Approve, run with automatic review | Only when the platform offers auto review: the conversation switches to **Auto review** and the agent starts a new turn that follows the plan |
| Approve, confirm each change | The conversation switches to **Ask every time** and follows the plan, asking you before every write |
| Keep refining | The mode stays; add a few notes if you like, and the agent keeps planning, usually with a new plan card |

Sending a message while the card waits means “keep refining” with that message; **Stop** discards the plan. **Only you can leave plan mode**: by approving on the plan card or by changing the mode in the composer; the agent cannot switch it. While running, the agent reports progress in its plan checklist, with at most one step in progress at a time.

See the repository's [plan mode](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#计划模式) section (Chinese).

## Clarifying questions and options

When the agent is unsure (for example, it finds several companies with similar names), it stops and asks you: 1 to 4 questions at a time, each with 2 to 4 options (single or multiple choice) plus **Other** to type your own answer. The turn waits for your answer, and you may also choose not to answer. What you type is passed to the model as data only.

## The chat page

Since v1.11.0, the **Assistant** button on the right opens chat beside the current business page; the panel can be minimized or expanded. The business URL, filters and page state remain. Independent conversation URLs still serve notices, sharing and existing links.

Since v1.12.0, chat is a desktop workspace (the admin web targets computers; use the mobile app on phones):

- **Layout**: drag the conversation list and the side panel, or use the left and right arrow keys, to resize them. Widths are remembered per user and browser, and a double-click on the divider restores the default. The list folds to a narrow rail. **Focus mode** hides the side menu and tabs, leaving only the conversation; press Esc or click again to leave.
- **Header**: three labelled buttons, **Work panel**, **Focus mode** and **Conversation settings**. The settings popover holds the conversation options (temporary conversation, memory, profile), notifications and keyboard shortcuts; opening in a new window, export and sharing are in the **Conversation actions** menu (⋮). A narrow column gets a compact header and a one-line toolbar.
- **Reading and typing**: answers use a centred reading column, and tables take their content width; message actions appear in one row on hover or focus. The composer placeholder only says `/` shows commands; the keys are listed on a hint line below.

- **Conversations and drafts**: open history when needed to create, search, rename, pin, archive or delete. Minimize and reopen without losing the conversation or draft. A new page's context applies only to a new conversation, without silently replacing an existing draft's source. Identity, tenant or permission changes clear the panel state.
- **Minimize and stop**: plain Esc in the composer minimizes the panel while work continues. Use **Stop** or a shortcut with a modifier to stop a turn. Keys consumed by a candidate menu or approval card do not also close the host. The independent page retains its original stop shortcut.
- **Reading answers**: streamed answers, collapsible calls and reasoning summaries; tables, nested lists, task lists, code copy/wrap, Markdown source switching, exact source download and expanded reading. HTML is shown as text; external Markdown images are not loaded automatically.
- **Work panel**: current tasks, sources and report/chart/image outputs open on demand. It sits in the side panel and can be opened in the main area and moved back. Switching conversations clears old previews immediately; approval remains on its original confirmation card.
- **Subtasks**: grouped by actual status, with active/finished counts, individual states and summaries. Open a read-only process view in the main area and use **Back to the conversation** to return, without changing the main conversation. Shared snapshots do not fetch private child conversations.
- **Fork, resend and revert**: fork from a message or edit and resend the last one. Revert removes the last turn; **changes it already made are not rolled back**. Stop active work first and personally reconcile unknown results before forking, reverting or deleting; these actions cannot clear unresolved risks.
- **Sharing and export**: same-tenant read-only links and Markdown export do not expand the viewer's business permissions.
- **Sending during a turn**: add to the current turn or queue the next one. While the turn waits on approval cards, a message rejects them with the message as the note; while it waits on a plan card, a message means “keep refining”. Attachments still enforce current file access.
- **Commands and notices**: `/` offers new conversation, compaction, model, approvals, skills and status commands. Waiting for confirmation or clarification and completion of a long turn still produce inbox notices, with optional mail.

See the repository's [chat panel](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#聊天面板) section (Chinese).

### Disconnections, refreshes and deployments

- **An uncertain send**: the same send uses the same UUID, with a durable server receipt. After a lost acknowledgement, the client only queries receipt status; it does not automatically resend. An explicit retry reuses the original identifier. Browser session storage keeps only identifiers isolated by user and tenant, never message bodies. A full refresh does not guarantee retention of an unsent plaintext draft; reconcile the previous send before entering a new message.
- **Recovering answers**: streamed text is saved to the database in batches about every 200 milliseconds before it is broadcast, with a revision and UTF-16 position. Reconnecting can fill in the prefix already displayed. After a server restart, recovery resumes the task, **not the original model token connection**; the current step may be interrupted and need regeneration. Queue and lease timing affect the wait, with no fixed recovery time.
- **Unknown effects pause work**: an unknown result from a write or paid image call pauses subsequent writes and image generation. Read-only queries remain available, and their model calls are still metered. Conversation allowances, automatic review and automations cannot bypass this pause. Personally check the business outcome and any charge, then acknowledge the current risk revision. This permits only later operations; old turns and queued messages are not replayed automatically. An automation with an unknown result is disabled and its pre-approval revoked; configure it again separately.
- **Reconcile before continuing**: a local write timeout or missing trustworthy output also counts as unknown. The pause cannot be cleared while the original work has not actually settled. Check remote non-idempotent operations in the external system; exactly-once effects cannot be guaranteed for arbitrary external services.

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

## Profiles

A **profile** is a named set of settings: model and reasoning effort, conversation mode, a list of allowed tools and extra instructions. In **Conversation settings** at the top of the chat page, **Manage** opens the list, where you add, edit and delete them.

- Profiles are **personal** or **tenant-wide** (changing tenant-wide ones needs the skill modify permission); other people's personal profiles stay invisible; each scope can have one default;
- When you start a conversation you pick a profile in **Conversation settings** (your own default is preselected, else the tenant-wide default), or **No profile**;
- **A tenant-wide profile's mode can only be read only, plan or ask every time**: auto review lets the review model agree to writes on your behalf, so only you can choose it, in a personal profile or in the conversation;
- Since v1.9.1, select from your available system tools or enter other tool identifiers, such as built-in or external MCP tools. An empty selection leaves tools unrestricted. If the tool list cannot be loaded, the page warns you and preserves existing selections;
- With a tool list, the agent can use only the listed tools (read-only built-in tools always stay); the extra instructions go into every request as background. Selecting or entering a tool does not grant permissions or bypass its approval policy.

See the repository's [profiles](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#配置方案) section (Chinese).

## Memory

Each person has a memory store of their own. The **My memories** button in **Conversation settings** at the top of the chat page lists it, with search, add, edit and delete; **Forget everything** needs your current password.

- **Saving**: when you explicitly say "remember …", the agent stops and shows you what it would save; **it is saved only after you confirm**, and an administrator cannot make this step automatic;
- **Background distilling** (optional): once the super administrator turns on the parameter `agent.memory.extract`, the system periodically distills memories from idle conversations, **reading only the messages you sent**, never the agent's answers, tool results, web pages or attachments;
- **Masking**: common forms of passwords, keys, tokens, ID card numbers, bank card numbers and mobile numbers are masked before saving;
- **Use**: in conversations with memory on (the **Use memory** switch in **Conversation settings** turns it off per conversation), the agent takes the entries most relevant to the question into account; temporary conversations neither read nor write memory. Memories and message text are masked as `***` in the action log, with no original text kept.

::: warning Masking is not a silver bullet
The masking rules only know common forms: they can mask too much (a ticket number that looks like a mobile number) or miss things (landline numbers, a passphrase with no hint word that does not look like a key). Don't ask the agent to remember anything sensitive; you can review and delete memories in **My memories** at any time.
:::

See the repository's [memory](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#记忆) section (Chinese).

## Limits, emergency stop and usage

Since v1.11.0, spending budgets use **credits**. Tokens remain actual usage counters and context observations:

| System parameter | Default | Scope |
| --- | --- | --- |
| `agent.limit.turn_credits` | `0` | Credits per turn |
| `agent.limit.user_daily_credits` | `0` | Credits per user per UTC day |
| `agent.limit.tenant_daily_credits` | `0` | Credits per tenant per UTC day |

For these three budgets, `0` means **unlimited**. Step, time, concurrency, research and automation limits remain independent; zero does not disable those safeguards. The emergency stop `agent.paused` is described above.

Each model call checks spending already recorded before starting. Once a budget is reached, no next call begins; **an in-flight or parallel call can cross the threshold**. This is an observed-spending budget, not a prepaid wallet or a guaranteed hard spending cap.

**Agent → Agent usage** groups credits and actual usage by day, user or model, with paginated per-call details: provider, exact model identifier, input/output/cache/reasoning counters, the rates used and the charge. Identical model names at different providers stay separate; changing rates does not reprice history. An explicit per-image fallback applies only when token-based pricing is unavailable, never together with a token charge.

Missing fields remain **unknown**, not zero. Older records without detailed usage or rate snapshots are marked historical, without invented past credits. Since v1.12.0:

- **Unpriced** only means the model has no rates: the call runs, is not charged in credits and is not limited by the three credit budgets;
- when a model has rates but this call's usage is unknown (the service reported none, or the call was stopped, timed out or failed before it ended), credits are estimated conservatively from the request and the streamed output, count toward the three budgets and are marked **estimated**; estimates stay out of token totals;
- the usage page's **Data completeness** note lists unpriced and unknown-usage calls separately, and the settings page warns when all three budgets are 0 that there is no credit cap.

 A failed call does not prove zero consumption; actual usage already reported by the provider is still recorded. Old token budgets are neither automatically converted to credits nor used as spending limits.

A pending record is saved before each model call. Recovery retains actual usage already obtained and its original rate snapshot; the call detail, daily, turn and parent-task totals are accounted once in the same transaction. Missing usage stays unknown in token totals; with rates, credits are estimated and recomputed from actual usage when a late receipt arrives. Under a finite budget, an overdue call not yet settled makes the next call wait for its settlement. Recovery never turns unknown consumption into zero.

`/status` separates estimated context capacity from recorded credits for the turn and today. The context gauge is not the provider's bill. See the repository's [limits, pause and usage](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#限额暂停与用量) section (Chinese).

## Sub-agents, deep research, charts / images / exports

- **Sub-agents**: the agent can hand 1 to 3 independent subtasks to sub-agents running in parallel. They run as the requester, **with read-only tools only**, cannot delegate further or ask you questions; to change data they can only suggest it in their summary, and the main conversation goes through normal approval. The **Subtasks** card groups actual states and summaries; open read-only details in place while the parent conversation and draft remain;
- **Deep research**: the platform skill **deep research** (start it with `$deep-research` in the input box) plans first, searches and reads several sources, then writes a **research report** with numbered citations. The turn has its own, wider step and time limits. Citations count only links the turn actually read; others are marked **Unverified**. A report exports to Markdown, prints as PDF, and each of its tables exports to Excel;
- **Charts**: with numbers at hand the agent can draw bar, line or pie charts or tables, rendered directly by the page without running any code; a chart's data exports to Excel;
- **Images**: when a model is marked **Image** in the settings, the agent can generate images, stored as private files of the requester, at most 4 per turn;
- Exported Excel cells are plain values: text starting with `=`, `+`, `-` or `@` gets a leading quote and never becomes a formula.

See the repository's [sub-agents](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#子智能体), [deep research](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#深度研究) and [charts, images and exports](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#图表图片与导出) sections (Chinese).

## Diagnostics

The **Diagnostics** tab of **Agent → Agent settings** is for the super administrator only: whether models and search providers are enabled and have a key (never the key itself), external MCP server connection states, the turn queue backlog, turn counts by state, the 20 most recent failed turns (without conversation content) and orphan turn sweeps. Each model provider, search provider and external MCP server has a **Test** button for a quick connectivity check; a failure shows only a reason (timeout, network, authentication, HTTP status and so on), never a key or the other side's error text.

See the repository's [diagnostics](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#诊断) section (Chinese).

## Notifications, shortcuts and new windows

- **Notification settings**: on the **Notifications** tab of **Conversation settings** at the top of the chat page, each kind of reminder (a long turn finishes, waiting for my confirmation or answer, automation results) can also **send an email**; all are off by default. Inbox messages always arrive, and the mobile app reads the inbox; emails go to the address in your profile, and without one you get only the inbox message;
- **Keyboard shortcuts**: the **Keyboard shortcuts** tab of **Conversation settings** lets you rebind four actions: new conversation, focus the message box, toggle plan mode and stop the turn. A combination needs Ctrl, Alt or ⌘ (stop may also be plain Esc); combinations the browser or page already uses are refused. The settings are saved in the current browser only;
- Plain Esc in the floating composer minimizes the panel; stopping there uses the Stop button or a shortcut with a modifier. The independent chat page retains its configured stop shortcut.
- **New window**: non-temporary conversations can be opened in a new window.

See the repository's [chat panel](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#聊天面板) section (Chinese).

## Batch runs and the "fill in customer details" sample

The template ships a sample: **Generator samples → Sample customers** holds a few well-known companies with some fields left empty on purpose, and the platform skill 补齐客户信息 comes with three tools (search customers, read a customer, update a customer).

- Ask in the chat, for example "fill in the industry of 华为技术有限公司";
- Or tick a few customers in the sample customer list and click **Let the agent fill in**: one conversation per customer, started in turn within the requester's concurrency limit, with every change stopping for approval;
- The batch review page lists each row's state and pending changes; confirm them one by one, or **Approve all** / **Reject all**.

Batch runs are granted separately and can only cover records you can see. To make your own list batchable, see the repository's [adding tools, batch targets and skills to your module](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#给自己的模块加工具批量目标与技能) and the [sample](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#批量执行与补齐客户信息示例) (Chinese).

## Automations

**Agent → Automations** runs a skill or a prompt in the background, with the results in your inbox. Each run opens a hidden conversation and runs **as its owner**, with the owner's permissions and data scope, checked again every time; **Open conversation** in the run history shows the whole run.

There are three triggers:

- **Schedule**: 5-field cron (minute hour day month weekday) with a time zone, at most every 5 minutes; the page offers common schedules such as daily or weekdays at 9:00;
- **Business event**: listens to a business action (for example creating a sample customer) and fires once it is in the action log; it runs only when the owner can see the record;
- **Manual**: **Run now**.

There are four write modes:

| Write mode | Meaning |
| --- | --- |
| Read only (default) | No write tools are offered |
| Ask | A write stops and its approval card goes to your inbox; it goes on once you confirm it in the conversation |
| Pre-approved | Write tools ticked one by one, **with your current password** when you add one; ticked writes run at once, other writes still wait for you |
| Auto review | Only when the platform has a review model: writes that need confirmation go to the review model; tools set to **People only** and actions that need your personal confirmation wait for you; see [Automatic review](#automatic-review) above |

About **pre-approval**:

- It only works with **your own personal skills, your own personal profiles or platform skills**; saving with a tenant-wide skill or profile is refused (other people can change their text);
- It **lapses** when your permissions, data scope or department for that tool change, when an administrator changes the tool's switch or policy, or when the bound skill's text or the profile's instructions change: the write then waits for a person, the list marks the tool **No longer valid**, and you must tick it again and enter your password;
- External MCP tools and built-in tools cannot be pre-approved.

Also:

- People with the share permission can create automations shared with the whole tenant: everyone in the tenant sees them, but only the owner can change, run them and see their history. When the owner is disabled or loses the permissions, the automation switches itself off and tells the owner;
- An automation runs one at a time; the super administrator limits automations per user (20 by default) and runs per automation per day (50 by default);
- Results always arrive as inbox messages, with optional mail.

See the repository's [automations](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#自动化) section (Chinese).

## Security model

- **Owned by the requester**: conversations, approvals and questions can be seen and acted on only by their owner; anyone else gets 404, and only the requester can confirm a change;
- **Runs as the user**: tools keep MCP's checks (permission, data scope, tenant and package, argument validation, time limit, masking of secret-named output fields). The agent can never do more than the requester could do on the pages; each turn reloads the requester's identity first and stops if the user was disabled or deleted;
- **Writes need a person's consent**: a write runs only in four cases: confirmed on the card each time; a tool you chose not to be asked about again in this conversation (after confirming it once); an automation's pre-approval given with your password (void once its conditions change); or, after you chose auto review mode, a write that needs confirmation approved by the review model. **People only** writes and writes that need personal confirmation allow only the first case. If permissions, the conversation mode or the policy changed after confirmation, the call is still blocked;
- **Outside content is untrusted**: web pages, search results and external MCP output are passed to the model as data only. Even if a page talks the model into changing data, the change stops at the approval card, which lists the sources;
- **Outbound requests go to public addresses only**: page reading and external MCP connect only to public addresses and recheck every redirect. The model's API address is not checked this way (so a local or internal Ollama works) and only the super administrator can set it;
- **Encrypted keys**: credentials of models, search providers and external MCP servers are encrypted with a key derived from `APP_SECRET` and are write-only; enter them again after changing `APP_SECRET`;
- **Audit**: every tool call (refused ones too) writes a row to **System → Logs → Action log**, marked as coming from the chat page; changed data records the requester as modifier as usual. Memories and message text are masked as `***` in the action and API logs, with no original text kept.

See the repository's [security model](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#安全模型) section (Chinese).

## For project developers

Besides adding tools, batch targets and skills to your own modules, the runtime has three extension points; a module registers its own provider and the agent module stays unchanged:

- **Built-in tools**: abilities that only make sense inside a chat (they need the turn's conversation, UI items, questions and so on); reading and writing business data still goes through MCP tools;
- **Context contributors**: add some background about the user to each turn, such as "memories about you"; this is not a rule, and the model may ignore it;
- **Approval reviewers**: judge a write by business rules before it waits for a person, for example rejecting obviously wrong ones or handing large amounts to a person; they can never bypass a person's consent.

See the repository's [extension points](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/agent.md#扩展点) section (Chinese) and the step-by-step recipe [built-in tools, context and approval rules for the assistant](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/ai/recipes/agent-extension.md).

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
