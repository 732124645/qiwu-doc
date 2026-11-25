---
description: '把栖梧模板发布的新版本合并进自己的项目：哪些文件属于项目、用 git 取得新版本、常见冲突的处理、项目的平台表和全局唯一键登记在 project-tables.ts、新迁移用真实的当前时间，以及合并后的检查。'
---

# 升级模板版本

用栖梧模板建好自己的项目以后，模板还会继续发布新版本（修复问题、增加功能）。这一页讲怎样把新版本**合并**进你的项目。本页是概览，命令和细节以仓库的[升级模板版本](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md)为准。

两件事不要混淆：

- **合并代码**（本页）：把模板新版本的代码并进你的项目仓库；
- **升级数据库**：代码合并以后，对已有的数据库执行迁移和种子（`pnpm db:migrate` → `pnpm db:seed`），见[部署](/guide/deploy)。

## 升级到 v1.17.0

本版整体移除了内置智能助手：`APP_AGENT` 开关、`/api/agent/*` 接口、**智能体** 菜单组及其页面、助手的种子和对应的文档、配方与技能都不再提供。[MCP 智能体接入](/features/mcp)（`APP_MCP`）保留，外部客户端的接口、护栏和各模块的工具不变。

v1.8.0 至 v1.16.0 已从公开仓库撤回，标签和发布已删除；其中与助手无关的变化都包含在本版里。从 v1.7.1 升级时，下面 v1.11.0 至 v1.16.0 各小节同样适用。

**曾合并过 v1.8.0 至 v1.16.0 标签的项目**：公开仓库的历史已经改写，新历史和那些标签只在 v1.7.1 及更早的提交上相交。合并 v1.17.0 时，git 以这些共同提交为基础比较两边，助手代码在项目自己的分支里仍然存在，不会被自动删除；合并时也可能出现冲突，需要逐个处理。不需要助手时，参照 v1.17.0 删除助手的目录和各处挂接点（模块注册、菜单和种子登记、共享包导出、依赖等，可对照下文的接口清单），再执行迁移，让退役迁移处理菜单、授权和参数；也可以选择保留这部分代码，由项目自己维护。

**先迁移，再重启。** 合并代码后照常执行 `pnpm db:migrate` → `pnpm db:seed`，再重启全部实例，**不要重置已有数据库**。新代码不再按 `APP_AGENT` 隐藏旧菜单，迁移完成前，有授权的用户会看到一个打不开的智能体分组。

- **退役迁移做了什么**：迁移 `20261125040531-agent-retire` 只在装过助手的数据库上起作用，软删助手的菜单、这些菜单的角色授权和租户套餐授权、`agent.*` 系统参数，以及助手的站内信和邮件模板。
- **保留了什么**：助手的数据表和历史数据全部保留，不会删表。确认项目自己没有读取这些表并做好备份后，才可以自行处理。
- **`APP_AGENT` 可以删**：`.env` 里的 `APP_AGENT` 删掉即可；留着也会被忽略，启动时的环境变量校验会丢弃未知键，不报错。
- **Redis 残留（可选清理）**：旧版本留下的助手数据不影响运行，包括 BullMQ 队列 `agent-turn`、`agent-cleanup`、`agent-automation`、`agent-memory`（键为 `qw:queue:<队列名>:*`，含其重复任务），以及 `qw:agent:*` 和 `qw:lock:agent-*` 键。要清理时，先停掉全部旧版本实例，再用 `SCAN` + `UNLINK` 删除，不要用 `KEYS` 或 `FLUSHDB`（共用的 Redis 里还有别的数据）。把 `-n` 换成部署的 `REDIS_DB`、`qw:` 换成实际的 `REDIS_KEY_PREFIX`，按需补上 `-h` / `-p`：

```sh
export REDISCLI_AUTH='<Redis 密码>'
for p in 'qw:queue:agent-turn:*' 'qw:queue:agent-cleanup:*' 'qw:queue:agent-automation:*' \
  'qw:queue:agent-memory:*' 'qw:agent:*' 'qw:lock:agent-*'; do
  redis-cli --user qiwu -n 13 --scan --pattern "$p" | xargs -r -n 100 redis-cli --user qiwu -n 13 UNLINK
done
```

项目代码用到下列已删除的接口时，按下面改：

- `@McpTool` 不再接受 `preview`、`highRisk`、`perCallConfirmation`、`confirmationRevision`，`MCP_CONFIRMATION_REVISION` 和 `ToolExecutionContext` 也已删除，工具方法只收到校验后的入参。写工具的预览和逐次本人确认随助手一起移除：删掉这些选项和对应的预览方法即可，MCP 写工具照常受令牌的写入许可、工具权限、数据范围和操作日志约束。`@AgentBatchTarget` 及其 `batchLabels` 一并删除。
- 本人收件箱接口的条目不再有 `action` 字段，前端按普通文本通知展示。
- B8xxx 错误码（`Err.AGENT_*`）已删除，引用处改用项目自己的错误码。
- 服务端核心删除了 `AuditWriter.onAction`（及 `ActionHeard`）、`ParamService.onInvalidate`、`maskSecrets`、`StorageService.putAgentImage`（及 `AGENT_IMAGE_TAG`）和 `CACHE_NAMESPACES` 的 `agent*` 项。需要在操作或参数变化后做事的，在项目自己的服务里显式调用；需要文本脱敏的，用 `core/redact.ts` 里仍保留的函数或项目自己的实现。
- `@qiwu/shared` 不再导出助手的 schema（`platform/agent/*`）、`DEMO_CUSTOMER_TARGET` / `DEMO_CUSTOMER_ENRICH_SKILL` 和实时事件 `RT.agentEvent`；`BUILTIN_MENU_GROUPS` 不再含 `agent`，`PLATFORM_ONLY_ROUTES` 不再含 `agent-setting`。
- 服务端去掉了依赖 `openai`，Web 去掉了 `marked`。项目直接用到它们时，加到自己的 `package.json`（需要构建脚本的包同样在 `allowBuilds` 登记）。

详细变化见 [v1.17.0 更新日志](/changelog#_1-17-0-·-2026-11-25)，以仓库的[升级到 v1.17.0](https://github.com/732124645/qiwu-vue-admin/blob/v1.17.0/docs/upgrade.md#升级到-v1170)为准。
正式发布：[v1.17.0](https://github.com/732124645/qiwu-vue-admin/releases/tag/v1.17.0)。

## 升级到 v1.16.0

v1.16.0 已撤回，以下内容包含在 v1.17.0 中。

本版新增聊天、消息、成员、表情与通话等存储结构，以及 App 会话相关配置。合并代码后先备份，再执行冻结安装、构建、`pnpm db:migrate` → `pnpm db:seed`，**不要重置已有数据库**；使用移动端时也要安装 `mobile/` 的独立依赖。

- `APP_IM` 和 `im.call.enabled` 默认关闭；种子和表结构会照常安装，启用前核对[租户套餐、员工范围和保留参数](/features/im#启用)。
- Web/H5 缓存使用 IndexedDB，App 使用 SQLite。恢复备份或重置数据库后，由超级管理员通过参数管理把 `im.sync.epoch` 改成新值；普通发版不要随意改它。
- App 长期会话和单 App 会话属于认证功能，不受聊天开关控制。`auth.mobile.session_days` 默认 `0`，`auth.app.single_session` 默认开；旧 App 没声明端类型时沿用原期限规则，需配套升级客户端。见[App 会话](/core/mobile#app-长期会话与单-app-会话)。
- App 新增 SQLite、Record 和 `qw-livekit` 原生能力，必须重新编译整包或自定义基座，填写自己的标识、签名和 HTTPS API 地址。wgt 不能向旧包添加原生模块。
- 语音消息可独立使用；实时通话须另行部署 LiveKit v1.13.11，保持禁止自动建房、配置 TURN 和仅服务端保存的控制密钥，再打开通话参数。见[LiveKit 接入](/core/livekit)。
- 不附第三方 SDK 二进制和签名 App 包；宿主安装、真实服务和硬件媒体未验收，Android 传递依赖分发许可仍待澄清。不要把原生编译或模拟器结果写成最终包可直接发布。
- 公开组合仍只含基础办公申请与审批，私有完整办公业务不在范围内；小程序聊天、离线推送和后台来电也未实施。

详细变化见 [v1.16.0 更新日志](/changelog#_1-16-0-·-2026-11-09)。

## 升级到 v1.15.0

v1.15.0 已撤回，以下内容包含在 v1.17.0 中。完成代码合并和检查后照常执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- 迁移给调度日志加两个可为空的列（执行实例和事件循环最大延迟），另给一张已退役功能的表加一个可为空的列；旧记录保持为空。
- 新增的环境变量（`APP_ROLE`、`DB_POOL_*`、`LOG_SLOW_REQUEST_MS` 等）默认值都不改变原有行为；默认的 `all` 角色会多一个空闲的 `scheduler-run` 队列，队列监控页能看到。
- 启动日志多一条 `.env` 与 `.env.local` 同键不同值的警告，以及一行 `effective config`；项目自己的非秘密键可以追加到 `EFFECTIVE_CONFIG_KEYS`。
- 要把后台任务拆到单独进程时，按[部署](/guide/deploy#使用-pm2-守护进程-可选)设置 `QW_PM2_WORKER_INSTANCES`；第一次开启和切回单个应用都要先 `pm2 delete` 再启动，并且至少保留一个 `all` 或 `worker` 实例，否则定时任务和队列都会停。

详细变化见 [v1.15.0 更新日志](/changelog#_1-15-0-·-2026-10-30)。

## 升级到 v1.14.0

v1.14.0 已撤回。照常执行迁移与种子；它的迁移只建一张已退役功能使用的表，不影响其他模块。

## 升级到 v1.13.0

v1.13.0 已撤回。照常执行迁移与种子，没有需要另外处理的变化。

## 升级到 v1.12.0

v1.12.0 已撤回，以下内容包含在 v1.17.0 中。没有新迁移，照常执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- 开发服务改为编译到独立的 `dist-dev/` 目录，由旧模板派生的项目要把它加入 `.gitignore`。

详细变化见 [v1.12.0 更新日志](/changelog#_1-12-0-·-2026-10-27)。

## 升级到 v1.11.0

v1.11.0 已撤回，以下内容包含在 v1.17.0 中。先备份业务库，保留 Redis 和 `APP_SECRET`，在已有数据库执行 `pnpm db:migrate` → `pnpm db:seed`，**不能用重置代替升级**。

- 当前公开版本只含基础 OA 申请和现有审批引擎，不含打卡考勤。升级会停用考勤的旧入口、授权和保留任务，保留已有业务数据和迁移执行记录。
- 已经用过这些功能的项目，先核对自己的源码和迁移依赖并保留备份；不要直接删表、重置数据库或手动删除迁移执行记录。

详细变化见 [v1.11.0 更新日志](/changelog#_1-11-0-·-2026-10-27)。

## 先少改模板的文件

升级时冲突多不多，取决于你的项目改了多少模板的文件。项目自己的代码和登记，尽量只写在项目自己的文件里：

| 归属 | 文件 |
| --- | --- |
| 项目 | 项目域目录（`apps/server/src/modules/<域>/`、`apps/web/src/views/<域>/`、`apps/web/src/api/<域>/`、`packages/shared/src/<域>/`）、`modules/project.module.ts`、`db/seeds/project/*`、`db/project-tables.ts`、项目自己的迁移、`.env*` 配置 |
| 模板 | `apps/server/src/core/`、`modules/platform/`、`modules/workflow/`，`apps/web/src/core/`、`views/platform/`、`views/workflow/`，`packages/shared` 的平台与公共部分，`core/db/tenant-tables.ts`，模板发布过的迁移，`scripts/`，模板的测试和文档 |
| 两边都改 | 语言包 JSON、`db/seeds/index.ts`（`SEEDS.project` 的登记）、各个 `package.json`、`pnpm-lock.yaml` |

模板里的 `biz`、`demo` 是示例项目域，可以修改或删除，删改过以后升级时按项目文件处理。确实要改模板文件时，改动尽量小而集中，并在提交说明里写清原因，升级时更容易认出来。见仓库的[哪些文件属于谁](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#1-哪些文件属于谁)。

### 项目的平台表和全局唯一键

开启[多租户](/features/multi-tenancy)时，新建的表默认是**租户表**（带 `tenant_id`，数据按租户隔离），不需要登记。只有两种情况要登记：

- **平台表**：由平台统一维护、所有租户共用的表；
- **全局唯一键**：必须在所有租户之间都不重复的唯一键，同时写明占用的值怎样释放（`none`、`row-delete`、`takeover`）。

项目的这两类登记写在项目自己的文件 `apps/server/src/db/project-tables.ts` 里（`PROJECT_PLATFORM_TABLES`、`PROJECT_GLOBAL_UNIQUE`），**不要改**模板的 `apps/server/src/core/db/tenant-tables.ts`。模板发布时这个项目文件是空的，升级也不会改它，所以这里不会冲突。规则见[编写租户感知的代码](/core/tenancy)和仓库的[项目自己的表、迁移与模板升级](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#7-项目自己的表迁移与模板升级)。

### 迁移的时间戳

迁移文件名是 `<14 位时间戳>-<名称>.ts`，类名以同一个时间戳结尾，比如 `20261020153817-crm-order.ts` 里的 `CrmOrder20261020153817`。

- 时间戳用**创建迁移时真实的当前时间，精确到秒**，不要用整点或整分。模板自己的迁移也在同一个目录里，整点时间容易和模板以后发布的迁移撞上；
- 每个时间戳必须唯一。`pnpm verify` 会检查，遇到重复的时间戳或者不是 14 位的文件名就报错。

## 取得新版本

模板的公开仓库是 [732124645/qiwu-vue-admin](https://github.com/732124645/qiwu-vue-admin)，每个版本有一个标签（比如 `v1.6.0`）。在项目仓库里加一次远端（叫 `upstream`），以后每次升级只需要取标签：

::: code-group

```bash [macOS]
git remote add upstream https://github.com/732124645/qiwu-vue-admin.git   # 只需执行一次
git fetch upstream --tags
git tag --list 'v*' --sort=-v:refname | head
```

```powershell [Windows（PowerShell）]
git remote add upstream https://github.com/732124645/qiwu-vue-admin.git   # 只需执行一次
git fetch upstream --tags
git tag --list "v*" --sort=-v:refname | Select-Object -First 10
```

:::

先在一个新分支上合并，确认没问题再并回主分支：

```bash
git switch -c upgrade-v1.6.0
git merge v1.6.0
```

合并前先读一遍[更新日志](/changelog)，留意不兼容的变化和新的环境变量。想要线性历史时，也可以把项目的提交变基到新标签上（`git rebase v1.6.0`）；但已经推送、多人共用的分支请用合并，不要变基。见仓库的[取得模板的新版本](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#2-取得模板的新版本)。

## 常见冲突

- **项目文件**（`project.module.ts`、`seeds/project/*`、`project-tables.ts`）：保留项目的登记，再看模板那边改了什么（比如新增的示例模块），决定要不要一起保留；
- **`db/seeds/index.ts`**：模板会在这里加平台种子，项目只在 `SEEDS.project` 里登记自己的种子。两边的条目都保留，顺序以模板的注释为准；
- **语言包 JSON**：两边各自新增的键都保留，注意 JSON 的逗号和括号；同一个键两边都改过时，以项目的文案为准。合并后运行 `pnpm i18n:check`，它会报出只在一种语言里有的键；
- **迁移**：迁移文件各自独立，一般不冲突。模板发布过的迁移不要修改或改名，已安装的数据库按名字记录它。项目迁移和模板迁移时间戳相同时，`pnpm verify` 会报出这两个文件：改项目自己的那个（文件名和类名换成当前时间）；如果它已经在某些数据库上执行过，还要在这些库里把执行记录改成新名字，做法见仓库；
- **执行顺序**：已有的数据库只执行还没执行过的迁移，按时间戳先后。项目迁移如果要用到模板新版本改过的表结构，它的时间戳必须晚于对应的模板迁移；
- **`package.json` 和 `pnpm-lock.yaml`**：先按两边的依赖合并 `package.json`；锁文件不要手工合并，取模板那一侧，再执行 `pnpm i` 重新生成；
- **模板的测试**：迁移测试从迁移目录读取清单、按规则检查每张表，项目新增的表和迁移不需要改模板的测试。

见仓库的[常见冲突与处理](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#3-常见冲突与处理)。

## 合并后的检查

在仓库根目录依次执行：

```bash
pnpm i
pnpm --filter @qiwu/shared build
pnpm ai:map
pnpm verify
pnpm --filter @qiwu/server build
pnpm --filter @qiwu/server test
```

最后做一次完整检查，它会清空重建测试库：

::: code-group

```bash [macOS]
pnpm ci:local
```

```powershell [Windows（PowerShell）]
pnpm ci:local --serial
```

:::

- 合并后运行 `pnpm ai:map` 重新生成[项目地图](/guide/ai#项目地图) `docs/ai/project-map.md` 并提交：模板和项目两边的改动都会让它过期，`pnpm verify` 会检查它；这个文件有冲突时也不要手工解决，直接重新生成；
- 本地反复调试服务端测试时，可以用快速模式 `QW_TEST_REUSE_DB=1`（见[后端测试 · 加快测试](/backend/testing#加快测试)），但升级是否成功，以完整重建测试库的那次运行为准；
- 开发库用 `pnpm db:migrate` 和 `pnpm db:seed` 升级，**不要**对已有的库执行 `pnpm db:reset`（它会清空数据）；
- 生产环境先备份数据库，再按[部署](/guide/deploy)的步骤执行迁移和种子。

新版本带来的可选模块由开关控制，默认关闭，比如[微信公众号](/features/wxoa)（`APP_WXOA`）和 [MCP 智能体接入](/features/mcp)（`APP_MCP`）。升级后它们保持关闭，数据表照常由迁移创建；需要时在 `.env` 里打开开关，再重启全部实例。见仓库的[合并后的检查](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#4-合并后的检查)。
